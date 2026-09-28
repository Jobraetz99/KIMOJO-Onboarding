import { msalInstance, loginRequest } from './authConfig'
import { GRAPH_CONFIG, SP_STATUS } from '@/config'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const DBG = (...a) => console.log('🔍 KIMOJO', ...a)
const ERR = (...a) => console.error('❌ KIMOJO', ...a)

// ─── Token helper ─────────────────────────────────────────────────────────────
async function getAccessToken() {
  const accounts = msalInstance.getAllAccounts()
  if (accounts.length === 0) throw new Error('Nicht angemeldet')
  const result = await msalInstance.acquireTokenSilent({
    ...loginRequest,
    account: accounts[0],
  })
  return result.accessToken
}

async function graphFetch(path, options = {}) {
  const token = await getAccessToken()
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Graph-Fehler ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

// ─── Paginierung: alle Seiten abrufen ────────────────────────────────────────
async function graphFetchAll(firstPath) {
  const token = await getAccessToken()
  let items = []
  let url = `${GRAPH_BASE}${firstPath}`

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message ?? `Graph-Fehler ${res.status}`)
    }
    const data = await res.json()
    items = items.concat(data.value ?? [])
    url = data['@odata.nextLink'] ?? null
    if (url) DBG(`Nächste Seite: ${items.length} Items bisher…`)
  }

  DBG(`graphFetchAll: ${items.length} Items total geladen`)
  return items
}

// ─── Site ID ──────────────────────────────────────────────────────────────────
let _siteId = null
async function getSiteId() {
  if (_siteId) return _siteId
  DBG('Löse Site-ID auf für:', GRAPH_CONFIG.sharePointHostname + GRAPH_CONFIG.sharePointSitePath)
  const data = await graphFetch(
    `/sites/${GRAPH_CONFIG.sharePointHostname}:${GRAPH_CONFIG.sharePointSitePath}`
  )
  _siteId = data.id
  DBG('Site-ID:', _siteId)
  return _siteId
}

// ─── List ID ──────────────────────────────────────────────────────────────────
let _listId = null
async function getListId() {
  if (_listId) return _listId
  const siteId = await getSiteId()
  DBG('Suche Liste mit Name:', `"${GRAPH_CONFIG.checklistListName}"`)
  const data = await graphFetch(`/sites/${siteId}/lists?$select=id,name&$top=200`)
  const allNames = (data?.value ?? []).map(l => l.name)
  DBG('Vorhandene Listen:', allNames)
  const list = (data?.value ?? []).find(l => l.name === GRAPH_CONFIG.checklistListName)
  if (!list) {
    ERR(`Liste nicht gefunden! Gesucht: "${GRAPH_CONFIG.checklistListName}"`)
    ERR('Verfügbare Listen:', allNames)
    throw new Error(`Liste "${GRAPH_CONFIG.checklistListName}" nicht gefunden`)
  }
  _listId = list.id
  DBG('Listen-ID:', _listId)
  return _listId
}

// ─── Current user ─────────────────────────────────────────────────────────────
export async function fetchMe() {
  return graphFetch('/me?$select=id,displayName,mail,userPrincipalName,jobTitle')
}

// ─── Checkliste laden ─────────────────────────────────────────────────────────
/**
 * @param {string} userEmail       – E-Mail des eingeloggten Users (für Logs)
 * @param {string} userDisplayName – Anzeigename z.B. "Johannes Brätz"
 *                                   muss mit dem Verantwortlich-Feld übereinstimmen
 */
export async function fetchChecklist(userEmail, userDisplayName) {
  const siteId = await getSiteId()
  const listId = await getListId()

  // Expliziter $select: Verantwortlich muss explizit stehen → gibt Anzeigename zurück
  // RelevanterLink = echter interner SP-Feldname (kein Leerzeichen, keine Kodierung)
  const select = [
    'id', 'Title', 'Aufgabe',
    'Verantwortlich',
    'F_x00e4_lligkeit',
    'Status',
    'RelevanterLink',
  ].join(',')

  // graphFetchAll holt alle Seiten (à 200 Items) automatisch
  const rawItems = await graphFetchAll(
    `/sites/${siteId}/lists/${listId}/items` +
    `?$expand=fields($select=${select})&$top=200`
  )

  // Filter: nur Items wo Verantwortlich === eingeloggter User (Anzeigename)
  const name = userDisplayName?.trim() ?? ''

  const getVerantwortlich = (fields) => {
    const v = fields?.Verantwortlich
    if (!v) return ''
    const raw = typeof v === 'string' ? v : (v.LookupValue ?? v.DisplayName ?? '')
    return raw.trim()
  }

  // Unicode-normalisierter Vergleich: ä kann als U+00E4 (NFC) oder a+U+0308 (NFD) gespeichert sein
  const norm = s => s.normalize('NFC').toLowerCase().trim()
  const nameNorm = norm(name)

  // Debug: zeige für jeden Mitarbeiter welchen Verantwortlich-Wert er hat
  const byMitarbeiter = {}
  rawItems.forEach(i => {
    const m = i.fields?.Title ?? '(leer)'
    const v = getVerantwortlich(i.fields) || '(leer)'
    if (!byMitarbeiter[m]) byMitarbeiter[m] = new Set()
    byMitarbeiter[m].add(v)
  })
  DBG('Mitarbeiter → Verantwortlich:',
    Object.fromEntries(Object.entries(byMitarbeiter).map(([k, v]) => [k, [...v]]))
  )
  // Charcode-Debug: zeigt ob ä als U+00E4 (NFC) oder a+U+0308 (NFD) vorliegt
  DBG(`Suche: "${name}" → normalisiert: "${nameNorm}"`)
  DBG(`Charcodesmeines Namens:`, [...name].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase()))

  // Luna-Weide-spezifisch: logge den exakten Verantwortlich-Wert inkl. Charcodes
  const lunaItem = rawItems.find(i => (i.fields?.Title ?? '').includes('Luna'))
  if (lunaItem) {
    const lv = getVerantwortlich(lunaItem.fields)
    DBG(`LunaWeide Verantwortlich: "${lv}"`)
    DBG(`LunaWeide Charcodes:`, [...lv].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase()))
    DBG(`LunaWeide normalisiert: "${norm(lv)}" === "${nameNorm}" → ${norm(lv) === nameNorm}`)
  }

  const filtered = name
    ? rawItems.filter(i => norm(getVerantwortlich(i.fields)) === nameNorm)
    : rawItems

  DBG(`Filter → ${filtered.length} von ${rawItems.length} Items`)

  return filtered.map(normalizeItem)
}

// ─── Normalisierung ────────────────────────────────────────────────────────────
function normalizeItem(item) {
  const f = item.fields ?? {}

  // Aufgabe = task title; Title = Mitarbeiter (umbenanntes Titelfeld)
  const title           = f.Aufgabe ?? ''
  const mitarbeiterName = f.Title ?? ''
  // Verantwortlich: je nach Abfragemodus als String oder Lookup-Objekt
  const verantwortlichRaw = f.Verantwortlich ?? f.VerantwortlichId ?? null
  const verantwortlichName =
    typeof verantwortlichRaw === 'string'
      ? verantwortlichRaw
      : verantwortlichRaw?.LookupValue ?? verantwortlichRaw?.DisplayName ?? ''

  // Link-Feld: echter interner Name ist "RelevanterLink"
  const linkRaw =
    f.RelevanterLink            ??
    f['Relevanter_x0020_Link']  ??
    f['Relevanter_Link']        ??
    f.RelevantLink              ??
    f.RelevantesLink            ??
    null

  const relevantLink = linkRaw?.Url
    ? { url: linkRaw.Url, label: linkRaw.Description || linkRaw.Url }
    : typeof linkRaw === 'string' && linkRaw.startsWith('http')
    ? { url: linkRaw, label: linkRaw }
    : null

  const faelligkeitRaw = f['F_x00e4_lligkeit'] ?? f.Faelligkeit ?? null

  return {
    id: item.id,
    title,
    verantwortlichName,
    mitarbeiterName,
    faelligkeit:  faelligkeitRaw ? new Date(faelligkeitRaw) : null,
    status:       f.Status ?? SP_STATUS.offen,
    relevantLink,
  }
}

// ─── Status aktualisieren ─────────────────────────────────────────────────────
export async function updateTaskStatus(taskId, done) {
  const siteId = await getSiteId()
  const listId = await getListId()
  return graphFetch(`/sites/${siteId}/lists/${listId}/items/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: { Status: done ? SP_STATUS.erledigt : SP_STATUS.offen }
    })
  })
}

// ─── Fälligkeit aktualisieren ─────────────────────────────────────────────────
export async function updateTaskDate(taskId, isoDate) {
  const siteId = await getSiteId()
  const listId = await getListId()
  return graphFetch(`/sites/${siteId}/lists/${listId}/items/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: { 'F_x00e4_lligkeit': isoDate ?? null }
    })
  })
}

// ─── Site-ID dynamisch aus URL auflösen ───────────────────────────────────────
const _siteIdCache = {}
async function resolveSiteIdFromUrl(sharePointUrl) {
  try {
    const parsed   = new URL(sharePointUrl)
    const hostname = parsed.hostname
    const clean    = parsed.pathname.replace(/^\/w\/r/, '')
    const parts    = clean.split('/')
    const idx      = parts.findIndex(p => p === 'sites')
    if (idx === -1) return null
    const siteName = parts[idx + 1]
    if (!siteName) return null
    if (_siteIdCache[siteName]) return _siteIdCache[siteName]
    const data = await graphFetch(`/sites/${hostname}:/sites/${siteName}`)
    _siteIdCache[siteName] = data.id
    DBG('resolveSiteId:', siteName, '→', data.id)
    return data.id
  } catch {
    return null
  }
}

// ─── Sharing-URL → Drive-Item auflösen (Shares API) ─────────────────────────
// Funktioniert mit ALLEN SharePoint-URLs: Sharing-Links, direkte Pfade, etc.
// Gibt { itemId, driveId, siteId } zurück oder null
async function resolveViaSharesApi(sharePointUrl) {
  try {
    // Base64url-Encoding der URL für die Shares API
    const encoded = 'u!' + btoa(sharePointUrl)
      .replace(/=+$/, '')
      .replace(/\//g, '_')
      .replace(/\+/g, '-')
    const item = await graphFetch(
      `/shares/${encoded}/driveItem?$select=id,name,file,folder,parentReference`
    )
    if (item?.id) {
      const isFolder = !!item.folder
      const isFile   = !!item.file
      DBG('Shares API: Gefunden →', item.name, isFolder ? '(ORDNER)' : '(DATEI)',
          'driveId:', item.parentReference?.driveId)
      // Ordner nicht als Datei zurückgeben – SmartViewer soll FolderView verwenden
      if (isFolder) {
        DBG('Shares API: Überspringe Ordner – wird von FolderView behandelt')
        return null
      }
      return {
        itemId:  item.id,
        driveId: item.parentReference?.driveId,
        siteId:  item.parentReference?.siteId,
      }
    }
  } catch (e) {
    DBG('Shares API fehlgeschlagen:', e.message)
  }
  return null
}

// ─── Drive-Item-ID via Suche finden ──────────────────────────────────────────
// Gibt { itemId, driveId } zurück oder null
async function findDriveItemId(siteId, sharePointUrl) {
  const parsed = new URL(sharePointUrl)

  // Methode A: Shares API – funktioniert mit fast allen SharePoint-URLs
  const shared = await resolveViaSharesApi(sharePointUrl)
  if (shared) return shared

  // Methode B: Suche per GUID (sourcedoc-Parameter)
  const guidMatch = sharePointUrl.match(
    /[?&]sourcedoc=(?:%7B|\{)?([0-9A-Fa-f-]{36})(?:%7D|\})?/i
  )
  if (guidMatch) {
    const guid = guidMatch[1]
    DBG('Suche nach GUID:', guid)
    try {
      const res = await graphFetch(
        `/sites/${siteId}/drive/root/search(q='${guid}')` +
        `?$select=id,name,parentReference&$top=5`
      )
      if (res?.value?.length > 0) {
        const v = res.value[0]
        DBG('Gefunden via GUID-Suche:', v.name)
        return { itemId: v.id, driveId: v.parentReference?.driveId, siteId }
      }
    } catch (e) { DBG('GUID-Suche fehlgeschlagen:', e.message) }
  }

  // Methode C: Suche per Dateiname (file-Parameter)
  const fileParam = parsed.searchParams.get('file')
  if (fileParam) {
    let cleanName = fileParam
    try { cleanName = decodeURIComponent(cleanName) } catch {}
    cleanName = cleanName.replace(/%u[\da-fA-F]{4}/g, '').trim()
    cleanName = cleanName.replace(/^[^\w\däöüÄÖÜß]+/, '').trim()
    const searchTerm = cleanName.replace(/\.\w+$/, '').trim()

    if (searchTerm.length > 3) {
      DBG('Suche nach Dateiname:', searchTerm)
      try {
        const res = await graphFetch(
          `/sites/${siteId}/drive/root/search(q='${encodeURIComponent(searchTerm)}')` +
          `?$select=id,name,parentReference&$top=10`
        )
        const match = res?.value?.find(v =>
          v.name?.toLowerCase().includes(searchTerm.toLowerCase().slice(0, 20))
        ) ?? res?.value?.[0]
        if (match?.id) {
          DBG('Gefunden via Dateiname-Suche:', match.name)
          return { itemId: match.id, driveId: match.parentReference?.driveId, siteId }
        }
      } catch (e) { DBG('Dateiname-Suche fehlgeschlagen:', e.message) }
    }
  }

  // Methode D: Pfad-basierte Auflösung für direkte Datei-URLs
  //   z.B. /sites/allcompany/Freigegebene Dokumente/Ordner/Datei.docx
  const pathMatch = sharePointUrl.match(/\/sites\/[^/]+\/([^?#]+)/)
  if (pathMatch) {
    const afterSite = decodeURIComponent(pathMatch[1]).replace(/\/Forms\/.*$/i, '')
    // Prüfe ob es eine Dateiendung hat (also eine Datei, kein Ordner/Aspx-Seite)
    if (/\.\w{2,5}$/.test(afterSite) && !/\.aspx$/i.test(afterSite)) {
      const parts = afterSite.split('/')
      const libraryName = parts[0]
      const filePath = parts.slice(1).join('/')

      if (filePath) {
        DBG('Pfad-Auflösung: Library=', libraryName, 'Datei=', filePath)
        try {
          // Richtiges Drive finden
          const drives = await graphFetch(`/sites/${siteId}/drives?$select=id,name&$top=50`)
          const drive = (drives?.value ?? []).find(d =>
            d.name.normalize('NFC').toLowerCase() === libraryName.normalize('NFC').toLowerCase()
          )
          if (drive) {
            const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
            const item = await graphFetch(
              `/sites/${siteId}/drives/${drive.id}/root:/${encodedPath}?$select=id,name`
            )
            if (item?.id) {
              DBG('Gefunden via Pfad:', item.name)
              return { itemId: item.id, driveId: drive.id, siteId }
            }
          }
        } catch (e) { DBG('Pfad-Auflösung fehlgeschlagen:', e.message) }
      }
    }
  }

  return null
}

// ─── Datei Embed-URL via Graph Preview API ────────────────────────────────────
// Gibt eine vorher signierte URL zurück – kein Login im iframe nötig
export async function getFileEmbedUrl(sharePointUrl) {
  try {
    // 1. Richtige Site-ID auflösen (allcompany, MitarbeiterOnboardingSeite etc.)
    const siteId = await resolveSiteIdFromUrl(sharePointUrl) ?? await getSiteId()

    // 2. Drive-Item-ID + Drive-ID finden (Shares API → GUID → Dateiname → Pfad)
    const resolved = await findDriveItemId(siteId, sharePointUrl)

    if (resolved?.itemId) {
      // 3. Signierte Preview-URL holen
      //    Wichtig: /drives/{driveId}/items direkt (OHNE /sites/ prefix) –
      //    Drive-IDs sind global eindeutig in Graph API
      const previewPath = resolved.driveId
        ? `/drives/${resolved.driveId}/items/${resolved.itemId}/preview`
        : `/sites/${siteId}/drive/items/${resolved.itemId}/preview`

      DBG('getFileEmbedUrl: Preview-Pfad:', previewPath)
      const preview = await graphFetch(previewPath, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (preview?.getUrl) {
        DBG('getFileEmbedUrl: Signierte URL ✓', preview.getUrl.slice(0, 60) + '…')
        return preview.getUrl
      }
    }

    // Kein Embed möglich → null zurückgeben damit der Viewer den Fallback zeigt
    // NIEMALS die Original-SP-URL zurückgeben: sie redirectet zu login.microsoft.com
    // welcher X-Frame-Options: DENY setzt und den iframe blockiert
    DBG('getFileEmbedUrl: Kein Embed möglich → Fallback-View')
    return null
  } catch (e) {
    ERR('getFileEmbedUrl Fehler:', e.message)
    return null
  }
}

// ─── Ordnerinhalt laden (für Ordner-Links in Tasks) ──────────────────────────
// Unterstützt SharePoint-URLs mit id-Parameter:
//   ?id=/sites/KIMOJOTeam-Portal/Standardprozesse/Praxismanager Prozesse/Behandlungsablauf/1. Termin
// Erkennt automatisch die richtige Dokumentbibliothek (Drive)
export async function fetchFolderContents(sharePointUrl) {
  try {
    const parsed = new URL(sharePointUrl)

    // 0. Sharing-Link-Format erkennen (z.B. /:f:/s/allcompany/...)
    //    /:f:/ = Ordner, /:w:/ = Word, /:x:/ = Excel, /:p:/ = PowerPoint
    const isSharingLink = /^\/:[\w]:\//.test(parsed.pathname)
    if (isSharingLink) {
      DBG('fetchFolderContents: Sharing-Link erkannt:', parsed.pathname.slice(0, 10))
      // Shares API nutzen um den Ordner aufzulösen
      const encoded = 'u!' + btoa(sharePointUrl)
        .replace(/=+$/, '')
        .replace(/\//g, '_')
        .replace(/\+/g, '-')
      try {
        const item = await graphFetch(
          `/shares/${encoded}/driveItem?$select=id,name,file,folder,parentReference`
        )
        if (item?.folder) {
          const driveId = item.parentReference?.driveId
          DBG('fetchFolderContents: Sharing-Ordner aufgelöst →', item.name, 'driveId:', driveId)
          if (driveId) {
            const data = await graphFetch(
              `/drives/${driveId}/items/${item.id}/children` +
              `?$select=id,name,webUrl,size,lastModifiedDateTime,file,folder&$top=100&$orderby=name`
            )
            const siteId = item.parentReference?.siteId ?? null
            return mapFolderItems(data, siteId, driveId)
          }
        }
        // Sharing-Link zeigt auf eine Datei, kein Ordner → null
        if (item?.file) {
          DBG('fetchFolderContents: Sharing-Link ist eine Datei, kein Ordner')
          return null
        }
      } catch (e) { DBG('fetchFolderContents: Shares API fehlgeschlagen:', e.message) }
    }

    const siteId = await resolveSiteIdFromUrl(sharePointUrl) ?? await getSiteId()

    // 1. Ordnerpfad ermitteln: aus "id"-Parameter (häufigstes Format) oder aus dem Pfad
    let fullPath = null
    const idParam = parsed.searchParams.get('id')
    if (idParam) {
      fullPath = decodeURIComponent(idParam)
    } else {
      fullPath = decodeURIComponent(parsed.pathname)
    }

    if (!fullPath) { DBG('fetchFolderContents: Kein Pfad erkannt'); return null }

    // 2. Site-Pfad entfernen um Library + Ordnerpfad zu erhalten
    //    fullPath: /sites/KIMOJOTeam-Portal/Standardprozesse/Praxismanager Prozesse/...
    //    → nach Site-Part: Standardprozesse/Praxismanager Prozesse/...
    const siteMatch = fullPath.match(/\/sites\/[^/]+\/(.+)/)
    if (!siteMatch) { DBG('fetchFolderContents: Kein Site-Pfad in', fullPath); return null }

    const afterSite = siteMatch[1].replace(/\/Forms\/.*$/i, '').replace(/\/+$/, '')
    const parts = afterSite.split('/')
    const libraryName = parts[0]          // z.B. "Standardprozesse"
    const folderPath  = parts.slice(1).join('/')  // z.B. "Praxismanager Prozesse/Behandlungsablauf/1. Termin"

    DBG(`fetchFolderContents: Library="${libraryName}", Pfad="${folderPath}"`)

    // 3. Die richtige Dokumentbibliothek (Drive) finden
    //    "Freigegebene Dokumente" / "Shared Documents" = URL-Pfadname des Default-Drives.
    //    In Graph API heißt es aber anders (z.B. "Dokumente" / "Documents").
    //    → Erkennung und direktes Mapping zum Default-Drive.
    const DEFAULT_LIB_NAMES = [
      'freigegebene dokumente', 'shared documents',
      'dokumente', 'documents', 'shared%20documents',
    ]
    const isDefaultLib = DEFAULT_LIB_NAMES.includes(libraryName.normalize('NFC').toLowerCase())

    if (isDefaultLib) {
      DBG(`fetchFolderContents: "${libraryName}" ist Default-Bibliothek → /drive/root`)
      try {
        const defaultDrive = await graphFetch(`/sites/${siteId}/drive?$select=id`).catch(() => null)
        const defaultDriveId = defaultDrive?.id ?? null
        let apiPathDefault
        if (folderPath) {
          const encodedFolder = folderPath.split('/').map(encodeURIComponent).join('/')
          apiPathDefault = `/sites/${siteId}/drive/root:/${encodedFolder}:/children`
        } else {
          apiPathDefault = `/sites/${siteId}/drive/root/children`
        }
        const data = await graphFetch(
          apiPathDefault + `?$select=id,name,webUrl,size,lastModifiedDateTime,file,folder&$top=100&$orderby=name`
        )
        return mapFolderItems(data, siteId, defaultDriveId)
      } catch (e) {
        DBG('fetchFolderContents: Default-Drive Fehler:', e.message)
        return null
      }
    }

    const drives = await graphFetch(`/sites/${siteId}/drives?$select=id,name&$top=50`)
    const allDrives = drives?.value ?? []
    DBG('fetchFolderContents: Verfügbare Drives:', allDrives.map(d => d.name))

    const drive = allDrives.find(d =>
      d.name.normalize('NFC').toLowerCase() === libraryName.normalize('NFC').toLowerCase()
    )
    if (!drive) {
      DBG(`fetchFolderContents: Drive "${libraryName}" nicht gefunden, versuche als Ordner im Default-Drive`)
      // libraryName ist vielleicht ein Ordner im Default-Drive (nicht die Bibliothek)
      const encodedFull = afterSite.split('/').map(encodeURIComponent).join('/')
      try {
        const defaultDrive = await graphFetch(`/sites/${siteId}/drive?$select=id`).catch(() => null)
        const defaultDriveId = defaultDrive?.id ?? null
        const data = await graphFetch(
          `/sites/${siteId}/drive/root:/${encodedFull}:/children` +
          `?$select=id,name,webUrl,size,lastModifiedDateTime,file,folder&$top=100&$orderby=name`
        )
        return mapFolderItems(data, siteId, defaultDriveId)
      } catch { return null }
    }

    // 4. Ordnerinhalt aus dem richtigen Drive laden
    let apiPath
    if (folderPath) {
      const encodedFolder = folderPath.split('/').map(encodeURIComponent).join('/')
      apiPath = `/sites/${siteId}/drives/${drive.id}/root:/${encodedFolder}:/children`
    } else {
      // Kein Unterordner → Root des Drive
      apiPath = `/sites/${siteId}/drives/${drive.id}/root/children`
    }

    const data = await graphFetch(
      apiPath + `?$select=id,name,webUrl,size,lastModifiedDateTime,file,folder&$top=100&$orderby=name`
    )
    return mapFolderItems(data, siteId, drive.id)
  } catch (e) {
    ERR('fetchFolderContents Fehler:', e.message)
    return null
  }
}

function mapFolderItems(data, siteId, driveId) {
  const items = (data?.value ?? []).map(item => ({
    id:       item.id,
    name:     item.name,
    url:      item.webUrl,
    size:     item.size,
    modified: item.lastModifiedDateTime,
    isFile:   !!item.file,
    isFolder: !!item.folder,
    mimeType: item.file?.mimeType ?? null,
    siteId,
    driveId,
  }))
  DBG(`fetchFolderContents: ${items.length} Items geladen`)
  return items.length > 0 ? items : null
}

// ─── SharePoint-Seitenstruktur laden (Kacheln + Quick-Links) ─────────────────
export async function fetchSitePageContent(siteUrl) {
  try {
    const siteId = await resolveSiteIdFromUrl(siteUrl)
    if (!siteId) return null

    const quickLinks = []
    const heroTiles = []

    // 1. Quick Launch Navigation
    try {
      const nav = await graphFetch(`/sites/${siteId}/navigation/quickLaunch`)
      DBG('Quick Launch RAW:', JSON.stringify(nav, null, 2))
      for (const item of nav?.items ?? []) {
        quickLinks.push({
          title: item.displayName,
          url: item.url ?? '',
          isExternal: item.isExternal ?? false,
        })
        // Untermenüs auch erfassen
        for (const child of item.items ?? []) {
          quickLinks.push({
            title: child.displayName,
            url: child.url ?? '',
            isExternal: child.isExternal ?? false,
          })
        }
      }
    } catch (e) { DBG('Quick Launch fehlgeschlagen:', e.message) }

    // 2. Top Navigation
    try {
      const topNav = await graphFetch(`/sites/${siteId}/navigation/topNavigation`)
      DBG('Top Navigation RAW:', JSON.stringify(topNav, null, 2))
      for (const item of topNav?.items ?? []) {
        if (!quickLinks.find(q => q.url === item.url)) {
          quickLinks.push({
            title: item.displayName,
            url: item.url ?? '',
            isExternal: item.isExternal ?? false,
          })
        }
      }
    } catch (e) { DBG('Top Navigation fehlgeschlagen:', e.message) }

    // 3. Homepage-Seite finden und Web Parts auslesen
    try {
      const pages = await graphFetch(
        `/sites/${siteId}/pages/microsoft.graph.sitePage?$select=id,name,title,webUrl&$top=20`
      )
      DBG('Pages gefunden:', (pages?.value ?? []).map(p => `${p.name} (${p.title})`))

      const homePage = (pages?.value ?? []).find(p =>
        p.name?.toLowerCase() === 'home.aspx' ||
        p.title?.toLowerCase() === 'home' ||
        p.title?.toLowerCase() === 'startseite'
      )

      if (homePage) {
        DBG('Homepage gefunden:', homePage.name, homePage.id)

        // Web Parts der Homepage laden
        try {
          const pageDetail = await graphFetch(
            `/sites/${siteId}/pages/${homePage.id}/microsoft.graph.sitePage?$expand=canvasLayout`
          )
          DBG('Page Detail Keys:', Object.keys(pageDetail ?? {}))

          const sections = pageDetail?.canvasLayout?.horizontalSections ?? []
          DBG(`${sections.length} Sections gefunden`)

          for (const section of sections) {
            for (const col of section.columns ?? []) {
              for (const wp of col.webparts ?? []) {
                const wpType = wp['@odata.type'] ?? 'unknown'
                DBG('WebPart:', wpType, JSON.stringify(wp).slice(0, 500))

                // Alle Daten aus dem Web Part extrahieren
                const wpData = wp.data ?? {}
                const serverData = wpData.serverProcessedContent ?? {}
                const properties = wpData.properties ?? {}

                const links = serverData.links ?? {}
                const texts = serverData.searchablePlainTexts ?? {}
                const imgSrcs = serverData.imageSources ?? {}

                // DEBUG: Zeige die tatsächlichen Keys
                DBG('wpData keys:', Object.keys(wpData))
                DBG('serverProcessedContent keys:', Object.keys(serverData))
                if (Object.keys(texts).length > 0) DBG('searchablePlainTexts:', texts)
                if (Object.keys(links).length > 0) DBG('links:', links)
                if (Object.keys(imgSrcs).length > 0) DBG('imageSources:', imgSrcs)
                DBG('properties keys:', Object.keys(properties))

                // Hero Web Part erkennen
                const isHero = wpType.includes('hero') ||
                  properties.heroLayoutType != null ||
                  properties.layoutCategory != null ||
                  properties.content != null

                if (isHero) {
                  const count = properties.content?.length ?? 0
                  DBG('HERO: items =', count)
                  // Versuch 1: serverProcessedContent (Graph v1.0 Format)
                  for (let i = 0; i < 20; i++) {
                    const title = texts[`content[${i}].title`] ?? texts[`content[${i}].callToActionText`] ?? ''
                    const url = links[`content[${i}].link`] ?? links[`content[${i}].previewImage.url`] ?? ''
                    const image = imgSrcs[`content[${i}].previewImage.url`] ?? imgSrcs[`content[${i}].image.url`] ?? null
                    const desc = texts[`content[${i}].description`] ?? ''
                    if (title || url) {
                      heroTiles.push({ title, description: desc, url, image })
                    }
                  }
                  // Versuch 2: properties.content direkt (alternatives Format)
                  if (heroTiles.length === 0 && Array.isArray(properties.content)) {
                    DBG('HERO Fallback: properties.content direkt:', JSON.stringify(properties.content[0]).slice(0, 500))
                    properties.content.forEach(item => {
                      heroTiles.push({
                        title: item.title ?? item.callToActionText ?? '',
                        description: item.description ?? '',
                        url: item.link ?? item.sourceItem?.url ?? '',
                        image: item.previewImage?.url ?? item.image?.url ?? null,
                      })
                    })
                  }
                }

                // Quick Links Web Part erkennen
                const isQuickLinks = wpType.includes('quickLinks') ||
                  properties.items != null ||
                  properties.isMigrated != null

                if (isQuickLinks && !isHero) {
                  const count = properties.items?.length ?? 0
                  DBG('QUICKLINKS: items =', count)
                  DBG('QUICKLINKS texts keys:', Object.keys(texts))
                  DBG('QUICKLINKS links keys:', Object.keys(links))

                  // Dynamisch: Alle Keys aus texts/links parsen statt feste Indices
                  const titleKeys = Object.keys(texts).filter(k => k.match(/items\[\d+\]\.title$/))
                  const urlKeys = Object.keys(links).filter(k => k.match(/items\[\d+\]/))

                  for (const tk of titleKeys) {
                    const idx = tk.match(/items\[(\d+)\]/)?.[1]
                    if (idx == null) continue
                    const title = texts[tk] ?? ''
                    // URL kann unter verschiedenen Keys liegen
                    const url = links[`items[${idx}].sourceItem.url`]
                      ?? links[`items[${idx}].url`]
                      ?? links[`items[${idx}].link`]
                      ?? ''
                    const icon = imgSrcs[`items[${idx}].thumbnailImage.url`]
                      ?? imgSrcs[`items[${idx}].image.url`]
                      ?? null
                    if (title && url && !quickLinks.find(q => q.title === title)) {
                      quickLinks.push({ title, url, icon, isExternal: !url.includes('sharepoint.com') })
                    }
                  }

                  // Fallback: Auch URLs ohne Titel erfassen
                  if (quickLinks.length === 0) {
                    for (const uk of urlKeys) {
                      const idx = uk.match(/items\[(\d+)\]/)?.[1]
                      if (idx == null) continue
                      const url = links[uk] ?? ''
                      const title = texts[`items[${idx}].title`] ?? texts[`items[${idx}].altText`] ?? `Link ${Number(idx) + 1}`
                      if (url && !quickLinks.find(q => q.url === url)) {
                        quickLinks.push({ title, url, isExternal: !url.includes('sharepoint.com') })
                      }
                    }
                  }

                  DBG('QUICKLINKS extrahiert:', quickLinks.length)
                }
              }
            }
          }
        } catch (e) {
          DBG('Canvas Layout fehlgeschlagen:', e.message)
          // Fallback: Versuche direkte webParts API
          try {
            const wpList = await graphFetch(
              `/sites/${siteId}/pages/${homePage.id}/microsoft.graph.sitePage/webParts`
            )
            DBG('WebParts API RAW:', JSON.stringify(wpList, null, 2).slice(0, 2000))
          } catch (e2) { DBG('WebParts API auch fehlgeschlagen:', e2.message) }
        }
      }
    } catch (e) {
      DBG('Pages API fehlgeschlagen:', e.message)
    }

    // Leere Links rausfiltern
    const filteredLinks = quickLinks.filter(l => l.title && l.url)
    DBG(`fetchSitePageContent ERGEBNIS: ${heroTiles.length} Hero-Tiles, ${filteredLinks.length} Quick-Links`)
    DBG('Hero Tiles:', heroTiles)
    DBG('Quick Links:', filteredLinks)

    return { quickLinks: filteredLinks, heroTiles }
  } catch (e) {
    ERR('fetchSitePageContent Fehler:', e.message)
    return null
  }
}

// ─── Alle Dokumentbibliotheken einer Site laden ─────────────────────────────
// Gibt [{id, name, driveId, description, itemCount, lastModified}] zurück
export async function fetchSiteDrives(siteUrl) {
  try {
    const siteId = await resolveSiteIdFromUrl(siteUrl)
    if (!siteId) { ERR('fetchSiteDrives: Site nicht gefunden für', siteUrl); return [] }

    const data = await graphFetch(
      `/sites/${siteId}/drives?$select=id,name,description,lastModifiedDateTime,quota&$top=50`
    )
    const drives = (data?.value ?? [])
      .filter(d => d.name) // System-Drives ohne Namen ignorieren
      .map(d => ({
        id:           d.id,
        name:         d.name,
        driveId:      d.id,
        description:  d.description ?? '',
        itemCount:    d.quota?.used ? Math.round(d.quota.used / 1024 / 1024) : null, // MB
        lastModified: d.lastModifiedDateTime,
        isFolder:     true,
        isDrive:      true, // Markierung: das ist ein Drive, kein normaler Ordner
        siteId,
      }))

    DBG(`fetchSiteDrives: ${drives.length} Drives geladen`)
    return drives
  } catch (e) {
    ERR('fetchSiteDrives Fehler:', e.message)
    return []
  }
}

// ─── Root-Inhalt eines Drives laden ─────────────────────────────────────────
export async function fetchDriveRoot(driveId) {
  try {
    const data = await graphFetch(
      `/drives/${driveId}/root/children` +
      `?$select=id,name,webUrl,size,lastModifiedDateTime,file,folder&$top=200&$orderby=name`
    )
    return mapFolderItems(data, null, driveId)
  } catch (e) {
    ERR('fetchDriveRoot Fehler:', e.message)
    return null
  }
}

// ─── Ordner-Kinder über Drive/Item-ID laden (für Unterordner-Navigation) ─────
export async function fetchFolderChildrenById(driveId, folderId) {
  try {
    const data = await graphFetch(
      `/drives/${driveId}/items/${folderId}/children` +
      `?$select=id,name,webUrl,size,lastModifiedDateTime,file,folder&$top=100&$orderby=name`
    )
    // siteId nicht nötig, driveId reicht für Preview
    return mapFolderItems(data, null, driveId)
  } catch (e) {
    ERR('fetchFolderChildrenById Fehler:', e.message)
    return null
  }
}

// ─── Direkte Preview-URL über IDs (ohne URL-Parsing) ─────────────────────────
// Wird für Dateien aus Ordner-Listings verwendet, wo wir IDs bereits kennen
// Fallback: Download-URL wenn Preview nicht verfügbar
export async function getPreviewUrlDirect(siteId, driveId, itemId) {
  // 1. Versuch: Signierte Preview-URL (ideal für Office-Dokumente)
  try {
    const path = siteId
      ? `/sites/${siteId}/drives/${driveId}/items/${itemId}/preview`
      : `/drives/${driveId}/items/${itemId}/preview`
    const preview = await graphFetch(path, { method: 'POST', body: JSON.stringify({}) })
    if (preview?.getUrl) {
      DBG('getPreviewUrlDirect: Signierte URL ✓')
      return preview.getUrl
    }
  } catch (e) {
    DBG('getPreviewUrlDirect: Preview fehlgeschlagen, versuche Download-URL…', e.message)
  }

  // 2. Fallback: Download-URL (funktioniert für PDFs, Bilder, Videos direkt)
  try {
    const downloadUrl = await getDownloadUrl(driveId, itemId)
    if (downloadUrl) {
      DBG('getPreviewUrlDirect: Fallback auf Download-URL ✓')
      return downloadUrl
    }
  } catch (e) {
    ERR('getPreviewUrlDirect: Auch Download-URL fehlgeschlagen:', e.message)
  }

  return null
}

// ─── Download-URL holen (temporär, ohne Auth im Browser nutzbar) ─────────────
// Gibt @microsoft.graph.downloadUrl zurück – funktioniert direkt für Bilder, PDFs, Videos
export async function getDownloadUrl(driveId, itemId) {
  try {
    const data = await graphFetch(
      `/drives/${driveId}/items/${itemId}?$select=id,name,@microsoft.graph.downloadUrl`
    )
    const url = data?.['@microsoft.graph.downloadUrl']
    if (url) {
      DBG('getDownloadUrl: ✓', url.slice(0, 60) + '…')
      return url
    }
    return null
  } catch (e) {
    ERR('getDownloadUrl Fehler:', e.message)
    return null
  }
}

// ─── Dateityp-Kategorie bestimmen ────────────────────────────────────────────
export function getFileType(filename) {
  const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) return 'image'
  if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext)) return 'office'
  if (ext === 'pdf') return 'pdf'
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio'
  if (['txt', 'csv', 'json', 'xml', 'html', 'css', 'js'].includes(ext)) return 'text'
  return 'other'
}

// ─── .url Dateien auflösen (Windows-Shortcuts) ──────────────────────────────
// Lädt den Inhalt einer .url-Datei und extrahiert die Ziel-URL
export async function resolveUrlFile(driveId, itemId) {
  try {
    const downloadUrl = await getDownloadUrl(driveId, itemId)
    if (!downloadUrl) return null
    const res = await fetch(downloadUrl)
    const text = await res.text()
    // .url Dateien haben Format: [InternetShortcut]\nURL=https://...
    const match = text.match(/URL\s*=\s*(.+)/i)
    if (match?.[1]) {
      const targetUrl = match[1].trim()
      DBG('resolveUrlFile: Ziel-URL:', targetUrl)
      return targetUrl
    }
    return null
  } catch (e) {
    ERR('resolveUrlFile Fehler:', e.message)
    return null
  }
}

// ─── Standort aus E-Mail ableiten ─────────────────────────────────────────────
export function detectLocation(email = '') {
  const e = (email ?? '').toLowerCase()
  if (e.includes('@kimojo-physio')) return 'werneck'
  if (e.includes('@phfip.de'))      return 'kitzingen'
  return 'unknown'
}

// ─── Rekursiv alle Dateien + Ordner aus einem Ordner laden ────────────────────
// Gibt sowohl Dateien als auch Ordner zurück (mit path), max. 5 Ebenen tief
async function fetchFolderRecursive(siteId, folderId, parentPath = '', depth = 0) {
  if (depth > 4) return []  // max 5 Ebenen
  try {
    const data = await graphFetch(
      `/sites/${siteId}/drive/items/${folderId}/children` +
      `?$select=id,name,webUrl,size,lastModifiedDateTime,file,folder&$top=200`
    )
    const items = data?.value ?? []
    const results = []

    for (const item of items) {
      const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name
      if (item.file) {
        results.push({ name: item.name, path: itemPath, url: item.webUrl, size: item.size, modified: item.lastModifiedDateTime, isFile: true })
      } else if (item.folder) {
        // Ordner selbst zur Liste hinzufügen (damit AI die Struktur kennt)
        results.push({ name: item.name, path: itemPath, url: item.webUrl, isFile: false, childCount: item.folder.childCount ?? 0 })
        // Rekursiv Unterordner laden
        const subItems = await fetchFolderRecursive(siteId, item.id, itemPath, depth + 1)
        results.push(...subItems)
      }
    }
    return results
  } catch { return [] }
}

// ─── Dokumente aus einer einzelnen Site laden ─────────────────────────────────
async function fetchDocumentsFromSite(siteUrl, siteLabel) {
  try {
    const parsed   = new URL(siteUrl)
    const hostname = parsed.hostname
    const sitePath = parsed.pathname
    const data = await graphFetch(`/sites/${hostname}:${sitePath}`)
    const siteId = data?.id
    if (!siteId) return []

    // Drive-Root ID holen
    const driveRoot = await graphFetch(`/sites/${siteId}/drive/root?$select=id`)
    if (!driveRoot?.id) return []

    // Rekursiv alle Dateien und Ordner laden
    const allItems = await fetchFolderRecursive(siteId, driveRoot.id, '', 0)

    const files   = allItems.filter(i => i.isFile)
    const folders = allItems.filter(i => !i.isFile)
    DBG(`fetchDocumentsFromSite [${siteLabel}]: ${files.length} Dateien, ${folders.length} Ordner`)

    return allItems.map(item => ({
      name:     item.name,
      path:     item.path,
      url:      item.url,
      size:     item.size,
      modified: item.modified,
      site:     siteLabel,
      isFile:   item.isFile,
    }))
  } catch (e) {
    ERR(`fetchDocumentsFromSite [${siteLabel}] Fehler:`, e.message)
    return []
  }
}

// ─── Alle relevanten Dokumente laden (für AI-Kontext) ─────────────────────────
// userEmail bestimmt welche standortspezifischen Sites geladen werden:
//   @kimojo-physio.* → Werneck → KIMOJOTeam-Portal
//   @phfip.de        → Kitzingen → PfFiP-TeamPortal
export async function fetchAllDocuments(userEmail = '') {
  const location = detectLocation(userEmail)
  DBG(`fetchAllDocuments: Standort="${location}" (${userEmail})`)

  // Immer: allgemeine Site (Allcompany)
  const sitesToFetch = [
    {
      url:   'https://kimojophysiotherapie.sharepoint.com/sites/allcompany',
      label: 'Allgemein (alle Standorte)',
    },
  ]

  // Standortspezifische Site
  if (location === 'werneck') {
    sitesToFetch.push({
      url:   'https://kimojophysiotherapie.sharepoint.com/sites/KIMOJOTeam-Portal',
      label: 'KIMOJO Werneck',
    })
  } else if (location === 'kitzingen') {
    sitesToFetch.push({
      url:   'https://kimojophysiotherapie.sharepoint.com/sites/PfFiP-TeamPortal',
      label: 'Kitzingen (Physio & Fitness)',
    })
  } else {
    // Unbekannt → beide Sites laden
    sitesToFetch.push(
      { url: 'https://kimojophysiotherapie.sharepoint.com/sites/KIMOJOTeam-Portal', label: 'KIMOJO Werneck' },
      { url: 'https://kimojophysiotherapie.sharepoint.com/sites/PfFiP-TeamPortal',   label: 'Kitzingen (Physio & Fitness)' },
    )
  }

  const results  = await Promise.all(sitesToFetch.map(s => fetchDocumentsFromSite(s.url, s.label)))
  const allDocs  = results.flat()
  DBG(`fetchAllDocuments: ${allDocs.length} Dokumente aus ${sitesToFetch.length} Sites`)
  return allDocs
}

// ─── SharePoint Volltextsuche (für AI-Kontext) ────────────────────────────────
// Gibt Treffer mit echtem Text-Snippet aus dem Dokumentinhalt zurück.
export async function searchSharePoint(query, userEmail = '') {
  try {
    const location = detectLocation(userEmail)

    // 1. Graph Search API — sucht im Inhalt ALLER SharePoint-Dokumente + Listen
    const result = await graphFetch('/search/query', {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            entityTypes: ['driveItem'],
            query: { queryString: query },
            size: 10,
          },
          {
            entityTypes: ['listItem'],
            query: { queryString: query },
            size: 5,
          },
        ],
      }),
    })

    const stripTags = s => (s ?? '').replace(/<\/?[^>]+>/g, '').trim()

    // Alle Treffer sammeln (driveItem + listItem)
    const allHits = []
    for (const container of (result?.value ?? [])) {
      for (const hit of (container?.hitsContainers?.[0]?.hits ?? [])) {
        const r = hit.resource ?? {}
        allHits.push({
          name:     r.name ?? r.fields?.title ?? '',
          url:      r.webUrl ?? '',
          snippet:  stripTags(hit.summary),
          driveId:  r.parentReference?.driveId ?? '',
          itemId:   r.id ?? '',
          isFile:   !!r.parentReference?.driveId,
        })
      }
    }

    DBG(`searchSharePoint [${location}]: ${allHits.length} Treffer für "${query}"`)

    // 2. Für die Top-Treffer echten Dokumentinhalt herunterladen
    const enriched = await Promise.all(
      allHits
        .filter(h => h.name && h.url)
        .slice(0, 8)
        .map(hit => enrichWithContent(hit))
    )

    return enriched
  } catch (e) {
    ERR('searchSharePoint Fehler:', e.message)
    return []
  }
}

// ─── Dokumentinhalt herunterladen und Text extrahieren ────────────────────────
async function enrichWithContent(hit) {
  // Kein driveItem → nur Snippet zurückgeben
  if (!hit.isFile || !hit.driveId || !hit.itemId) return hit

  const ext = (hit.name ?? '').split('.').pop()?.toLowerCase()

  // Nur für unterstützte Formate versuchen
  const textFormats = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'log']
  const officeFormats = ['docx', 'doc']
  const supported = [...textFormats, ...officeFormats, 'pdf']
  if (!supported.includes(ext)) return hit

  try {
    const token = await getAccessToken()
    const url = `${GRAPH_BASE}/drives/${hit.driveId}/items/${hit.itemId}/content`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'follow',
    })
    if (!res.ok) return hit

    // Textdateien → direkt lesen
    if (textFormats.includes(ext)) {
      const text = await res.text()
      hit.fullContent = text.slice(0, 5000)  // Max 5000 Zeichen pro Dokument
      DBG(`📄 Text extrahiert: ${hit.name} (${hit.fullContent.length} Zeichen)`)
      return hit
    }

    // Word-Dokumente → mit mammoth extrahieren
    if (officeFormats.includes(ext)) {
      try {
        const mammoth = await import('mammoth')
        const buffer = await res.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer: buffer })
        hit.fullContent = (result.value ?? '').slice(0, 5000)
        DBG(`📝 Word extrahiert: ${hit.name} (${hit.fullContent.length} Zeichen)`)
      } catch (e) {
        DBG(`⚠️ Word-Extraktion fehlgeschlagen für ${hit.name}: ${e.message}`)
      }
      return hit
    }

    // PDF → Text mit pdf.js wäre möglich, aber zu schwer. Nur Snippet nutzen.
    return hit
  } catch (e) {
    DBG(`⚠️ Content-Download fehlgeschlagen für ${hit.name}: ${e.message}`)
    return hit
  }
}

// ─── Allcompany Site ID (gecacht) ────────────────────────────────────────────
let _allcompanySiteId = null
async function getAllcompanySiteId() {
  if (_allcompanySiteId) return _allcompanySiteId
  const data = await graphFetch(`/sites/kimojophysiotherapie.sharepoint.com:/sites/allcompany`)
  _allcompanySiteId = data?.id
  return _allcompanySiteId
}

// Hilfsfunktion: Liste auf allcompany finden (nach Name, fuzzy)
const _listIdCache = {}
async function findAllcompanyList(searchName) {
  const siteId = await getAllcompanySiteId()
  if (!siteId) return null
  const cacheKey = searchName.toLowerCase()
  if (_listIdCache[cacheKey]) return _listIdCache[cacheKey]

  const lists = await graphFetch(`/sites/${siteId}/lists?$select=id,name&$top=200`)
  const norm = s => s.normalize('NFC').toLowerCase().replace(/[\s-]+/g, '')
  const list = (lists?.value ?? []).find(l => norm(l.name) === norm(searchName))
    ?? (lists?.value ?? []).find(l => norm(l.name).includes(norm(searchName)))
  if (list) {
    DBG(`findAllcompanyList: "${searchName}" → "${list.name}" (${list.id})`)
    _listIdCache[cacheKey] = { siteId, listId: list.id, listName: list.name }
    return _listIdCache[cacheKey]
  }
  DBG(`findAllcompanyList: "${searchName}" nicht gefunden. Listen:`, (lists?.value ?? []).map(l => l.name))
  return null
}

// ─── Quiz-Liste laden (MA-Onboarding Quizzes) ───────────────────────────────
export async function fetchQuizzes(userEmail = '') {
  try {
    const location = detectLocation(userEmail)
    const found = await findAllcompanyList('MA-Onboarding Quizzes')
    if (!found) return []

    const items = await graphFetchAll(
      `/sites/${found.siteId}/lists/${found.listId}/items?$expand=fields&$top=200`
    )

    const getLink = (f) => {
      const linkField = f['LinkzumQuiz'] ?? f['Link_x0020_zum_x0020_Quiz']
        ?? f['LinkZumQuiz'] ?? f['Link zum Quiz'] ?? null
      if (linkField?.Url) return linkField.Url
      if (typeof linkField === 'string' && linkField.startsWith('http')) return linkField
      return null
    }

    const quizzes = items
      .map(item => {
        const f = item.fields ?? {}
        return {
          id:       item.id,
          title:    f.Title ?? '',
          standort: f.Standorte ?? 'Alle',
          rolle:    f.Rolle ?? 'Alle',
          link:     getLink(f),
        }
      })
      .filter(q => q.title && q.link)
      .filter(q => {
        const s = (q.standort ?? '').toLowerCase()
        if (s === 'alle' || s === '') return true
        if (location === 'werneck' && s.includes('werneck')) return true
        if (location === 'kitzingen' && s.includes('kitzingen')) return true
        if (location === 'unknown') return true
        return false
      })

    DBG(`fetchQuizzes: ${quizzes.length} Quizze geladen (Standort: ${location})`)
    return quizzes
  } catch (e) {
    ERR('fetchQuizzes Fehler:', e.message)
    return []
  }
}

// ─── Quiz-Fortschritt laden ──────────────────────────────────────────────────
// Holt alle Einträge des aktuellen Users aus "MA-Onboarding Quiz Fortschritt"
export async function fetchQuizProgress(userDisplayName) {
  try {
    const found = await findAllcompanyList('MA-Onboarding Quiz Fortschritt')
    if (!found) return {}

    const cols = await getQuizProgressColumns(found.siteId, found.listId)

    const items = await graphFetchAll(
      `/sites/${found.siteId}/lists/${found.listId}/items?$expand=fields&$top=500`
    )

    // Debug: zeige erste Items um Feldnamen zu prüfen
    if (items.length > 0) {
      DBG('fetchQuizProgress: Beispiel-Item Felder:', Object.keys(items[0].fields ?? {}))
    }

    const norm = s => (s ?? '').normalize('NFC').toLowerCase().trim()
    const userName = norm(userDisplayName)

    const progress = {}
    items.forEach(item => {
      const f = item.fields ?? {}
      const mitarbeiter = norm(f[cols.mitarbeiter])
      if (mitarbeiter === userName) {
        const quizId = f[cols.quizId] ?? ''
        const status = f[cols.status] ?? ''
        if (quizId && status === 'Erledigt') {
          progress[quizId] = {
            itemId: item.id,
            completedAt: f[cols.datum] ?? null,
          }
        }
      }
    })

    DBG(`fetchQuizProgress: ${Object.keys(progress).length} Quizze erledigt für "${userDisplayName}"`)
    return progress
  } catch (e) {
    ERR('fetchQuizProgress Fehler:', e.message)
    return {}
  }
}

// ─── Quiz-Spalten ermitteln (einmalig) ──────────────────────────────────────
let _quizProgressColumns = null
async function getQuizProgressColumns(siteId, listId) {
  if (_quizProgressColumns) return _quizProgressColumns
  try {
    const cols = await graphFetch(
      `/sites/${siteId}/lists/${listId}/columns?$select=name,displayName&$top=50`
    )
    const allCols = cols?.value ?? []
    DBG('Quiz-Fortschritt Spalten:', allCols.map(c => `${c.displayName} → ${c.name}`))

    // Richtigen internen Spaltennamen finden
    const find = (...candidates) => {
      for (const c of candidates) {
        const match = allCols.find(col =>
          col.name.toLowerCase() === c.toLowerCase() ||
          col.displayName.toLowerCase() === c.toLowerCase()
        )
        if (match) return match.name
      }
      return candidates[0] // Fallback: ersten Kandidaten verwenden
    }

    _quizProgressColumns = {
      mitarbeiter: find('Mitarbeiter'),
      quizId:      find('QuizId', 'Quiz_x0020_Id', 'QuizID'),
      status:      find('Status'),
      datum:       find('AbgeschlossenAm', 'Abgeschlossen_x0020_Am', 'AbgeschlossenAm0'),
    }
    DBG('Quiz-Fortschritt Spalten-Mapping:', _quizProgressColumns)
    return _quizProgressColumns
  } catch (e) {
    DBG('Spalten-Erkennung fehlgeschlagen:', e.message)
    return { mitarbeiter: 'Mitarbeiter', quizId: 'QuizId', status: 'Status', datum: 'AbgeschlossenAm' }
  }
}

// ─── Quiz als erledigt markieren ─────────────────────────────────────────────
export async function markQuizDone(quizId, quizTitle, userDisplayName) {
  try {
    const found = await findAllcompanyList('MA-Onboarding Quiz Fortschritt')
    if (!found) throw new Error('Fortschritts-Liste nicht gefunden')

    const cols = await getQuizProgressColumns(found.siteId, found.listId)
    const now = new Date().toISOString()

    const fields = {
      Title: quizTitle,
      [cols.mitarbeiter]: userDisplayName,
      [cols.quizId]:      String(quizId),
      [cols.status]:      'Erledigt',
    }
    // Datum nur setzen wenn die Spalte existiert und nicht 'AbgeschlossenAm' als Fallback
    if (cols.datum) fields[cols.datum] = now

    DBG('markQuizDone: Schreibe Felder:', fields)
    await graphFetch(`/sites/${found.siteId}/lists/${found.listId}/items`, {
      method: 'POST',
      body: JSON.stringify({ fields })
    })
    DBG(`markQuizDone: "${quizTitle}" für "${userDisplayName}" ✓`)
    return true
  } catch (e) {
    ERR('markQuizDone Fehler:', e.message)
    return false
  }
}

// ─── Quiz als offen markieren (Eintrag löschen) ─────────────────────────────
export async function unmarkQuizDone(progressItemId) {
  try {
    const found = await findAllcompanyList('MA-Onboarding Quiz Fortschritt')
    if (!found) return false

    await graphFetch(
      `/sites/${found.siteId}/lists/${found.listId}/items/${progressItemId}`,
      { method: 'DELETE' }
    )
    DBG(`unmarkQuizDone: Item ${progressItemId} gelöscht ✓`)
    return true
  } catch (e) {
    ERR('unmarkQuizDone Fehler:', e.message)
    return false
  }
}

