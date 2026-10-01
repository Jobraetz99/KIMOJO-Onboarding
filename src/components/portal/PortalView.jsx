import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen, FileText, ChevronRight, Loader2, AlertCircle,
  ExternalLink, ChevronLeft, Link2, Newspaper,
} from 'lucide-react'
import {
  fetchSiteDrives, fetchDriveRoot, fetchFolderChildrenById,
  getPreviewUrlDirect, getDownloadUrl, getFileType, detectLocation,
  resolveUrlFile, getFileEmbedUrl, fetchFolderContents,
  fetchPortalPage, fetchPortalNews,
} from '@/services/graphService'
import clsx from 'clsx'

export default function PortalView({ user }) {
  const email = user?.mail || user?.userPrincipalName || ''
  const location = detectLocation(email)
  const isKitzingen = location === 'kitzingen'

  const siteUrl = isKitzingen
    ? 'https://kimojophysiotherapie.sharepoint.com/sites/PfFiP-TeamPortal'
    : 'https://kimojophysiotherapie.sharepoint.com/sites/KIMOJOTeam-Portal'

  const portalName = isKitzingen ? 'PfFiP Teamportal' : 'KIMOJO Teamportal'

  const [tab,         setTab]         = useState('start') // 'start' | 'dateien'
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [openFile,    setOpenFile]    = useState(null) // { driveId, itemId, name, url }

  // Navigation stack: [{ name, items, driveId? }]
  const [navStack, setNavStack] = useState([])

  // 1. Drives (Dokumentbibliotheken) laden
  useEffect(() => {
    setLoading(true)
    fetchSiteDrives(siteUrl)
      .then(d => {
        setNavStack([{ name: portalName, items: d, isDriveList: true }])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [siteUrl, portalName])

  // In ein Drive navigieren (Root laden)
  const openDrive = useCallback(async (drive) => {
    setLoading(true)
    const items = await fetchDriveRoot(drive.driveId)
    setLoading(false)
    if (items && items.length > 0) {
      setNavStack(prev => [...prev, { name: drive.name, items, driveId: drive.driveId }])
    } else {
      // Leeres Drive
      setNavStack(prev => [...prev, { name: drive.name, items: [], driveId: drive.driveId }])
    }
  }, [])

  // In einen Unterordner navigieren
  const openFolder = useCallback(async (folder) => {
    if (!folder.driveId || !folder.id) return
    setLoading(true)
    const items = await fetchFolderChildrenById(folder.driveId, folder.id)
    setLoading(false)
    setNavStack(prev => [...prev, {
      name: folder.name,
      items: items ?? [],
      driveId: folder.driveId,
    }])
  }, [])

  // Zurück navigieren
  const goBack = useCallback(() => {
    if (navStack.length > 1) {
      setNavStack(prev => prev.slice(0, -1))
    }
  }, [navStack.length])

  // Zu bestimmter Ebene springen
  const jumpTo = useCallback((index) => {
    setNavStack(prev => prev.slice(0, index + 1))
  }, [])

  // Kachel oder Quicklink öffnen. Ordner und Dateien bleiben in der App;
  // SharePoint-Seiten und externe Ziele müssen in einem neuen Tab öffnen,
  // weil SharePoint das Einbetten per X-Frame-Options unterbindet.
  const openLink = useCallback(async (link) => {
    // Die Ziele stammen aus der SharePoint-Seite, also aus fremden Daten:
    // alles ausser http(s) wird verworfen, sonst wäre javascript: möglich.
    if (!/^https?:\/\//i.test(link.url ?? '')) return
    const isSharePoint = link.url.includes('.sharepoint.com')
    const isSitePage   = /\.aspx(\?|#|$)/i.test(link.url)
                      && !/allitems\.aspx/i.test(link.url)

    if (!isSharePoint || isSitePage) {
      window.open(link.url, '_blank', 'noopener,noreferrer')
      return
    }

    setTab('dateien')
    setLoading(true)
    const items = await fetchFolderContents(link.url)
    setLoading(false)
    if (items) {
      setNavStack(prev => [...prev, { name: link.title, items }])
    } else {
      setOpenFile({ name: link.title, url: link.url })
    }
  }, [])

  const current = navStack[navStack.length - 1]
  const accentColor = isKitzingen ? 'text-phfip-teal' : 'text-kimojo-red'
  const accentBg = isKitzingen ? 'bg-phfip-light' : 'bg-kimojo-light'

  // Datei inline anzeigen
  if (openFile) {
    return (
      <InlineDocViewer
        file={openFile}
        onClose={() => setOpenFile(null)}
        accentColor={accentColor}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-xl ${accentBg} flex items-center justify-center`}>
            <FolderOpen size={20} className={accentColor} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-xl text-ink leading-tight">{portalName}</h2>
            <p className="font-body text-sm text-ink-muted">
              {tab === 'start' ? 'Aktuelles & Schnellzugriffe' : 'Dokumente & Dateien'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mt-1">
          {[['start', 'Start'], ['dateien', 'Dateien']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                'px-3.5 py-1.5 rounded-full font-body text-[13px] font-medium transition-colors',
                tab === key
                  ? `${accentBg} ${accentColor}`
                  : 'bg-gray-50 text-ink-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Breadcrumb */}
        {tab === 'dateien' && navStack.length > 1 && (
          <div className="flex items-center gap-1 mt-1 overflow-x-auto no-scrollbar pb-1">
            {navStack.map((level, i) => (
              <span key={i} className="flex items-center gap-1 flex-shrink-0">
                {i > 0 && <span className="text-[10px] text-ink-faint">›</span>}
                <button
                  onClick={() => jumpTo(i)}
                  className={clsx(
                    'text-[12px] font-body truncate max-w-[140px]',
                    i < navStack.length - 1
                      ? `${accentColor} font-medium`
                      : 'text-ink-muted'
                  )}
                >
                  {level.name}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {tab === 'start' && (
          <PortalStart
            siteUrl={siteUrl}
            onOpenLink={openLink}
            onShowFiles={() => setTab('dateien')}
            accentColor={accentColor}
            accentBg={accentBg}
          />
        )}

        {/* Back button when in subfolder */}
        {tab === 'dateien' && navStack.length > 1 && (
          <button
            onClick={goBack}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-body font-medium ${accentColor} bg-gray-50 border-b border-gray-100 w-full text-left`}
          >
            <ChevronLeft size={16} />
            Zurück
          </button>
        )}

        {/* Loading */}
        {tab === 'dateien' && loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={24} className={`${accentColor} animate-spin`} />
            <p className="text-ink-muted text-sm font-body">Wird geladen...</p>
          </div>
        )}

        {/* Error */}
        {tab === 'dateien' && error && !loading && (
          <div className="flex flex-col items-center gap-3 py-20 px-4 text-center">
            <AlertCircle size={28} className="text-kimojo-red" />
            <p className="font-body text-ink-muted text-sm">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {tab === 'dateien' && !loading && !error && current?.items?.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <FolderOpen size={36} className="text-gray-300" />
            <p className="text-ink-muted font-body text-sm">Dieser Ordner ist leer.</p>
          </div>
        )}

        {/* File/Folder list */}
        {tab === 'dateien' && !loading && !error && current?.items?.length > 0 && (
          <div className="px-4 py-3 space-y-2">
            {current.items.map((item, i) => (
              <motion.button
                key={item.id ?? i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => {
                  if (item.isDrive) {
                    openDrive(item)
                  } else if (item.isFolder) {
                    openFolder(item)
                  } else if (item.isFile) {
                    setOpenFile({
                      driveId: item.driveId,
                      itemId:  item.id,
                      name:    item.name,
                      url:     item.url,
                      siteId:  item.siteId,
                    })
                  }
                }}
                className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 text-left active:bg-gray-50 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                {/* Icon */}
                <span className="text-lg flex-shrink-0">
                  {item.isDrive ? '📚' : item.isFolder ? '📁' : fileIcon(item.name)}
                </span>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-body font-medium text-ink truncate">{item.name}</p>
                  <p className="text-[11px] font-body text-ink-faint">
                    {item.isDrive
                      ? item.description || 'Dokumentbibliothek'
                      : item.isFolder
                      ? 'Ordner'
                      : formatSize(item.size)
                    }
                    {item.modified && !item.isDrive && (
                      <> · {new Date(item.modified).toLocaleDateString('de-DE')}</>
                    )}
                  </p>
                </div>

                {/* Arrow */}
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </motion.button>
            ))}
          </div>
        )}
        <div className="h-8" />
      </div>
    </div>
  )
}


// ─── Portal-Startseite ──────────────────────────────────────────────────────
// Zeigt den Inhalt der SharePoint-Startseite nachgebaut: Texte, Kachelgruppen
// und die neuesten Newsbeiträge. Einbetten geht nicht – SharePoint verbietet
// iframes von fremden Domains (X-Frame-Options: SAMEORIGIN).
function PortalStart({ siteUrl, onOpenLink, onShowFiles, accentColor, accentBg }) {
  const [page,    setPage]    = useState(null)
  const [news,    setNews]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([fetchPortalPage(siteUrl), fetchPortalNews(siteUrl)])
      .then(([p, n]) => { if (active) { setPage(p); setNews(n) } })
      .catch(e => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [siteUrl])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={24} className={`${accentColor} animate-spin`} />
        <p className="text-ink-muted text-sm font-body">Portal wird geladen...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 px-6 text-center">
        <AlertCircle size={28} className="text-kimojo-red" />
        <p className="font-body text-ink-muted text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-5">
      {page?.blocks.map((block, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.3) }}
        >
          {block.kind === 'text' ? (
            <div
              className="portal-text font-body text-[14px] text-ink leading-relaxed"
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          ) : (
            <section className="space-y-2">
              {block.title && (
                <p className="text-ink-muted font-body text-xs font-medium uppercase tracking-wider px-1">
                  {block.title}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                {block.items.map((item, j) => (
                  <button
                    key={j}
                    onClick={() => onOpenLink(item)}
                    className="flex flex-col gap-2 bg-white border border-gray-100 rounded-2xl px-3.5 py-3.5 text-left active:scale-[0.98] transition-transform shadow-sm"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <div className={`w-9 h-9 rounded-xl ${accentBg} flex items-center justify-center`}>
                      <Link2 size={16} className={accentColor} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-[13px] text-ink leading-snug line-clamp-2">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="font-body text-[11px] text-ink-faint mt-0.5 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      ))}

      {news.length > 0 && (
        <section className="space-y-2">
          <p className="text-ink-muted font-body text-xs font-medium uppercase tracking-wider px-1">
            Aktuelles
          </p>
          {news.map(post => (
            <button
              key={post.id}
              onClick={() => window.open(post.url, '_blank', 'noopener,noreferrer')}
              className="w-full flex items-start gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 text-left active:bg-gray-50 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <div className={`w-9 h-9 rounded-xl ${accentBg} flex items-center justify-center flex-shrink-0`}>
                <Newspaper size={16} className={accentColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[14px] text-ink leading-snug">{post.title}</p>
                {post.teaser && (
                  <p className="font-body text-[12px] text-ink-muted mt-0.5 line-clamp-2">{post.teaser}</p>
                )}
                <p className="font-body text-[11px] text-ink-faint mt-1">
                  {new Date(post.modified).toLocaleDateString('de-DE')}
                </p>
              </div>
              <ExternalLink size={14} className="text-gray-300 flex-shrink-0 mt-1" />
            </button>
          ))}
        </section>
      )}

      <button
        onClick={onShowFiles}
        className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 text-left active:bg-gray-50 transition-colors"
        style={{ touchAction: 'manipulation' }}
      >
        <div className={`w-9 h-9 rounded-xl ${accentBg} flex items-center justify-center flex-shrink-0`}>
          <FolderOpen size={16} className={accentColor} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-[14px] text-ink">Alle Dateien</p>
          <p className="font-body text-[12px] text-ink-muted">Dokumentbibliotheken durchsuchen</p>
        </div>
        <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
      </button>

      {page?.blocks.length === 0 && news.length === 0 && (
        <p className="text-ink-faint font-body text-[12px] text-center px-4 pt-2">
          Diese Portalseite enthält keine Inhalte, die sich in der App darstellen lassen.
        </p>
      )}

      <div className="h-4" />
    </div>
  )
}


// ─── Inline Doc Viewer (Vollbild, typspezifisch) ────────────────────────────
function InlineDocViewer({ file, onClose, accentColor }) {
  const [contentUrl, setContentUrl]   = useState(null)
  const [loading,    setLoading]      = useState(true)
  const [failed,     setFailed]       = useState(false)
  const [iframeReady, setIframeReady] = useState(false)

  const rawFileType = getFileType(file.name)
  const isUrlFile = file.name?.toLowerCase().endsWith('.url')
  const [resolvedFileType, setResolvedFileType] = useState(isUrlFile ? null : rawFileType)
  const fileType = resolvedFileType ?? rawFileType

  useEffect(() => {
    setLoading(true)
    setFailed(false)
    setIframeReady(false)
    setContentUrl(null)
    if (isUrlFile) setResolvedFileType(null)
    else setResolvedFileType(rawFileType)

    const resolve = async () => {
      // .url Dateien: Ziel-URL auflösen und dann als normales Dokument behandeln
      if (isUrlFile && file.driveId && file.itemId) {
        const targetUrl = await resolveUrlFile(file.driveId, file.itemId)
        if (targetUrl) {
          // Dateityp der Ziel-URL erkennen
          const targetType = getFileType(targetUrl)
          setResolvedFileType(targetType)

          // Preview für die Ziel-URL über getFileEmbedUrl holen
          // Oder: wenn es ein SharePoint-Link ist, die Preview API nutzen
          const previewUrl = await getPreviewUrlDirect(file.siteId, file.driveId, file.itemId)
          if (previewUrl) { setContentUrl(previewUrl); setLoading(false); return }

          // Fallback: Ziel-URL direkt verwenden (z.B. für externe Links)
          setContentUrl(targetUrl); setLoading(false); return
        }
        setFailed(true); setLoading(false); return
      }

      // Kachel-Links liefern nur eine SharePoint-URL, kein Drive-Item. Die
      // Preview-URL muss dann über die Shares-API aufgelöst werden.
      if (!file.itemId && file.url) {
        const url = await getFileEmbedUrl(file.url)
        if (url) { setContentUrl(url); setLoading(false); return }
        setFailed(true); setLoading(false); return
      }

      // Bilder, Videos, Audio → Download-URL direkt (kein iframe nötig)
      if (['image', 'video', 'audio'].includes(fileType)) {
        const url = await getDownloadUrl(file.driveId, file.itemId)
        if (url) { setContentUrl(url); setLoading(false); return }
      }

      // Office-Dokumente, PDFs → Preview-URL (mit Download-Fallback)
      const url = await getPreviewUrlDirect(file.siteId, file.driveId, file.itemId)
      if (url) { setContentUrl(url); setLoading(false); return }

      setFailed(true)
      setLoading(false)
    }
    resolve()
  }, [file, rawFileType, isUrlFile])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        <button
          onClick={onClose}
          className={`flex items-center gap-2 text-sm font-body font-medium ${accentColor}`}
          style={{ touchAction: 'manipulation' }}
        >
          <ChevronLeft size={16} />
          Zurück
        </button>
        <span className="text-xs font-body font-medium text-ink-muted truncate max-w-[50vw] mx-3">
          {file.name}
        </span>
        <div className="flex-shrink-0" />
      </div>

      {/* Content – typspezifisch */}
      <div className="flex-1 min-h-0 relative bg-gray-50" style={{ WebkitOverflowScrolling: 'touch' }}>
        {loading && <ViewerLoader accentColor={accentColor} />}

        {!loading && failed && (
          <ViewerFallback file={file} onRetry={() => {
            setFailed(false)
            setLoading(true)
            getPreviewUrlDirect(file.siteId, file.driveId, file.itemId)
              .then(url => { if (url) { setContentUrl(url); setLoading(false) } else { setFailed(true); setLoading(false) } })
              .catch(() => { setFailed(true); setLoading(false) })
          }} />
        )}

        {!loading && !failed && contentUrl && (
          <>
            {/* Bilder: natives <img> mit Pinch-to-zoom */}
            {fileType === 'image' && (
              <div className="w-full h-full overflow-auto flex items-center justify-center p-4"
                   style={{ touchAction: 'pinch-zoom pan-x pan-y' }}>
                <img
                  src={contentUrl}
                  alt={file.name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                  onError={() => setFailed(true)}
                />
              </div>
            )}

            {/* Videos: natives <video> */}
            {fileType === 'video' && (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <video
                  src={contentUrl}
                  controls
                  playsInline
                  className="max-w-full max-h-full"
                  onError={() => setFailed(true)}
                >
                  Dein Browser unterstützt dieses Video nicht.
                </video>
              </div>
            )}

            {/* Audio: natives <audio> */}
            {fileType === 'audio' && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-8">
                <FileText size={48} className="text-gray-300" />
                <p className="font-display font-semibold text-ink text-base">{file.name}</p>
                <audio src={contentUrl} controls className="w-full max-w-sm" onError={() => setFailed(true)}>
                  Dein Browser unterstützt dieses Audio nicht.
                </audio>
              </div>
            )}

            {/* Office, PDF, Text, Other → iframe */}
            {!['image', 'video', 'audio'].includes(fileType) && (
              <>
                {!iframeReady && <ViewerLoader accentColor={accentColor} />}
                <iframe
                  src={contentUrl}
                  title={file.name}
                  className="w-full h-full border-0 block"
                  style={{ minHeight: '100%' }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  onLoad={() => setIframeReady(true)}
                  onError={() => setFailed(true)}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Viewer Hilfskompomenten ────────────────────────────────────────────────
function ViewerLoader({ accentColor }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-gray-50">
      <Loader2 size={28} className={`${accentColor ?? 'text-kimojo-red'} animate-spin`} />
      <p className="text-ink-muted text-sm font-body">Dokument wird geladen...</p>
    </div>
  )
}

function ViewerFallback({ file, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
        <FileText size={28} className="text-kimojo-red" />
      </div>
      <div className="space-y-1.5">
        <p className="font-display font-semibold text-ink text-base">{file.name}</p>
        <p className="text-ink-muted font-body text-sm leading-relaxed">
          Dieses Dokument konnte nicht geladen werden.
        </p>
      </div>
      <div className="flex flex-col gap-2.5 w-full max-w-xs">
        <button
          onClick={onRetry}
          className="flex items-center justify-center gap-2 bg-kimojo-red text-white font-body font-semibold text-sm rounded-xl px-5 py-3 active:scale-95 transition-transform"
          style={{ touchAction: 'manipulation' }}
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  )
}


// ─── Helpers ────────────────────────────────────────────────────────────────
function fileIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase() ?? ''
  if (['docx', 'doc'].includes(ext)) return '📝'
  if (['xlsx', 'xls'].includes(ext)) return '📊'
  if (['pptx', 'ppt'].includes(ext)) return '📑'
  if (['pdf'].includes(ext)) return '📄'
  if (['mp4', 'mov', 'avi'].includes(ext)) return '🎬'
  if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return '🖼️'
  if (['url'].includes(ext)) return '🔗'
  if (['txt', 'csv'].includes(ext)) return '📃'
  if (['zip', 'rar', '7z'].includes(ext)) return '📦'
  return '📄'
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
