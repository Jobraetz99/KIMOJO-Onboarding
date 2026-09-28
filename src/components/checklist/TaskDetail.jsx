import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, CheckCircle2, Circle, ExternalLink, ChevronRight,
  FileText, Loader2, Calendar, User,
  Maximize2, Minimize2, AlertCircle,
} from 'lucide-react'
import { SP_STATUS } from '@/config'
import { getFileEmbedUrl, getDownloadUrl, getFileType, fetchFolderContents, getPreviewUrlDirect, fetchFolderChildrenById } from '@/services/graphService'
import clsx from 'clsx'

export default function TaskDetail({ task, onToggle, onDateChange, onClose }) {
  const done = task.status === SP_STATUS.erledigt
  const hasDoc = !!task.relevantLink

  const handleDateChange = (e) => {
    const val = e.target.value
    onDateChange(task.id, val ? new Date(val).toISOString() : null)
  }

  const dateValue = task.faelligkeit
    ? task.faelligkeit.toISOString().split('T')[0]
    : ''

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Sheet – volle Höhe wenn Dokument vorhanden */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[1.75rem] flex flex-col"
        style={{ height: hasDoc ? '96vh' : 'auto', maxHeight: '96vh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-0.5 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Kompakter Header */}
        <div className="px-5 pt-2 pb-3 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-[18px] text-ink leading-snug break-words">
                {task.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                {task.mitarbeiterName && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-body text-ink-faint">
                    <User size={10} className="text-kimojo-red" />
                    {task.mitarbeiterName}
                  </span>
                )}
                <label className="inline-flex items-center gap-1 text-[11px] font-body text-ink-faint cursor-pointer">
                  <Calendar size={10} className="text-kimojo-red flex-shrink-0" />
                  <input
                    type="date"
                    value={dateValue}
                    onChange={handleDateChange}
                    className="bg-transparent outline-none text-[11px] font-body text-ink-faint cursor-pointer"
                  />
                </label>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"
            >
              <X size={15} className="text-ink-muted" />
            </button>
          </div>
        </div>

        {/* Dokument-Viewer, Ordner-Ansicht oder leerer Zustand */}
        <div className="flex-1 min-h-0 flex flex-col">
          {hasDoc ? (
            <SmartViewer link={task.relevantLink} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
              <FileText size={32} className="text-gray-300" />
              <p className="text-ink-muted font-body text-sm">Kein Dokument verknüpft.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pt-3 pb-8 flex-shrink-0 bg-white border-t border-gray-100">
          <button
            onClick={() => { onToggle(task.id, !done); onClose() }}
            className={clsx(
              'w-full flex items-center justify-center gap-2.5 font-body font-semibold text-[16px] rounded-2xl py-3.5 transition-all active:scale-[.98]',
              done
                ? 'bg-gray-100 text-ink-muted'
                : 'bg-kimojo-red text-white shadow-float'
            )}
          >
            {done
              ? <><Circle size={19} /> Als offen markieren</>
              : <><CheckCircle2 size={19} /> Als erledigt abhaken</>
            }
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ─── Smart Viewer: erkennt ob Ordner oder Datei ─────────────────────────────
function SmartViewer({ link }) {
  const [mode,         setMode]         = useState('loading')  // 'loading' | 'folder' | 'file'
  const [folderItems,  setFolderItems]  = useState([])
  const [openFile,     setOpenFile]     = useState(null) // { url, label } wenn eine Datei aus dem Ordner geöffnet wird

  useEffect(() => {
    let cancelled = false
    async function detect() {
      const url = link.url?.toLowerCase() ?? ''

      // Für alle SharePoint-URLs: IMMER erst als Ordner probieren
      if (url.includes('sharepoint.com')) {
        const items = await fetchFolderContents(link.url).catch(() => null)
        if (!cancelled && items && items.length > 0) {
          setFolderItems(items)
          setMode('folder')
          return
        }
      }
      // Kein Ordner → als Datei behandeln
      if (!cancelled) setMode('file')
    }
    detect()
    return () => { cancelled = true }
  }, [link.url])

  if (mode === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={28} className="text-kimojo-red animate-spin" />
      </div>
    )
  }

  // Einzelne Datei aus dem Ordner wird angezeigt → DocViewer für diese Datei
  if (openFile) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <button
          onClick={() => setOpenFile(null)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-body font-medium text-kimojo-red bg-gray-50 border-b border-gray-100 flex-shrink-0"
        >
          ← Zurück zur Übersicht
        </button>
        <DocViewer link={openFile} />
      </div>
    )
  }

  if (mode === 'folder') {
    return <FolderView items={folderItems} onOpenFile={setOpenFile} folderLink={link} />
  }

  return <DocViewer link={link} />
}

// ─── Ordner-Ansicht: zeigt Dateien als klickbare Liste mit Unterordner-Navigation
function FolderView({ items, onOpenFile, folderLink }) {
  // Stack für Ordner-Navigation: [{ name, items }]
  const [folderStack, setFolderStack] = useState([
    { name: folderLink.label && folderLink.label !== folderLink.url ? folderLink.label : 'Ordner', items }
  ])
  const [loadingSub, setLoadingSub] = useState(false)

  const current = folderStack[folderStack.length - 1]

  const openSubfolder = async (folder) => {
    if (!folder.driveId || !folder.id) {
      // Kein Drive-ID → leeren Ordner anzeigen statt Safari zu öffnen
      setFolderStack(prev => [...prev, { name: folder.name, items: [] }])
      return
    }
    setLoadingSub(true)
    const children = await fetchFolderChildrenById(folder.driveId, folder.id)
    setLoadingSub(false)
    // Auch leere Ordner in-app anzeigen (nie Safari öffnen)
    setFolderStack(prev => [...prev, { name: folder.name, items: children ?? [] }])
  }

  const goBack = () => {
    if (folderStack.length > 1) {
      setFolderStack(prev => prev.slice(0, -1))
    }
  }

  const fileIcon = (name) => {
    const ext = name.split('.').pop()?.toLowerCase()
    if (['docx', 'doc'].includes(ext)) return '📝'
    if (['xlsx', 'xls'].includes(ext)) return '📊'
    if (['pptx', 'ppt'].includes(ext)) return '📑'
    if (['pdf'].includes(ext)) return '📄'
    if (['mp4', 'mov', 'avi'].includes(ext)) return '🎬'
    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return '🖼️'
    if (['url'].includes(ext)) return '🔗'
    return '📄'
  }

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const fileCount = current.items.filter(i => i.isFile).length
  const folderCount = current.items.filter(i => i.isFolder).length
  const countLabel = [
    fileCount > 0 ? `${fileCount} Dateien` : null,
    folderCount > 0 ? `${folderCount} Ordner` : null,
  ].filter(Boolean).join(', ')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {folderStack.length > 1 && (
            <button onClick={goBack} className="text-kimojo-red font-body font-medium text-xs flex-shrink-0">
              ←
            </button>
          )}
          <span className="text-sm">📁</span>
          <span className="text-xs font-body font-medium text-ink-muted truncate">
            {current.name} ({countLabel})
          </span>
        </div>
        <a
          href={folderLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-body font-medium text-kimojo-red flex-shrink-0"
        >
          <ExternalLink size={12} />
          In SharePoint
        </a>
      </div>

      {/* Breadcrumb bei Unterordnern */}
      {folderStack.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-1.5 bg-gray-50/50 border-b border-gray-50 flex-shrink-0 overflow-x-auto">
          {folderStack.map((level, i) => (
            <span key={i} className="flex items-center gap-1 flex-shrink-0">
              {i > 0 && <span className="text-[10px] text-ink-faint">›</span>}
              <button
                onClick={() => { if (i < folderStack.length - 1) setFolderStack(prev => prev.slice(0, i + 1)) }}
                className={clsx(
                  'text-[11px] font-body truncate max-w-[120px]',
                  i < folderStack.length - 1 ? 'text-kimojo-red font-medium' : 'text-ink-muted'
                )}
              >
                {level.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Loading spinner for subfolder */}
      {loadingSub && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={22} className="text-kimojo-red animate-spin" />
        </div>
      )}

      {/* File list */}
      {!loadingSub && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {current.items.map((item, i) => (
            <button
              key={item.id ?? i}
              onClick={() => {
                if (item.isFile) {
                  onOpenFile({ url: item.url, label: item.name, siteId: item.siteId, driveId: item.driveId, itemId: item.id })
                } else {
                  openSubfolder(item)
                }
              }}
              className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3.5 py-3 text-left active:bg-gray-50 transition-colors"
            >
              <span className="text-lg flex-shrink-0">{item.isFolder ? '📁' : fileIcon(item.name)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-body font-medium text-ink truncate">{item.name}</p>
                {item.isFile && item.size && (
                  <p className="text-[11px] font-body text-ink-faint">{formatSize(item.size)}</p>
                )}
                {item.isFolder && (
                  <p className="text-[11px] font-body text-ink-faint">Ordner</p>
                )}
              </div>
              <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Dokument Viewer ──────────────────────────────────────────────────────────
function DocViewer({ link }) {
  const [contentUrl,  setContentUrl]  = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [iframeReady, setIframeReady] = useState(false)
  const [failed,      setFailed]      = useState(false)
  const [expanded,    setExpanded]    = useState(false)
  const [iframeKey,   setIframeKey]   = useState(0)
  const iframeRef = useRef(null)

  const fileType = getFileType(link.label ?? link.url ?? '')
  const canEmbed = canEmbedUrl(link.url)

  useEffect(() => {
    if (!canEmbed) { setLoading(false); setFailed(true); return }
    setLoading(true)
    setFailed(false)
    setIframeReady(false)

    const resolve = async () => {
      // Bilder, Videos, Audio mit IDs → Download-URL direkt
      if (['image', 'video', 'audio'].includes(fileType) && link.driveId && link.itemId) {
        const url = await getDownloadUrl(link.driveId, link.itemId)
        if (url) { setContentUrl(url); setLoading(false); return }
      }

      // IDs vorhanden → Preview direkt holen
      if (link.siteId && link.driveId && link.itemId) {
        const url = await getPreviewUrlDirect(link.siteId, link.driveId, link.itemId)
        if (url) { setContentUrl(url); setLoading(false); return }
        setFailed(true); setLoading(false); return
      }

      // Nur URL vorhanden → alte Logik
      try {
        const url = await resolveEmbedUrl(link.url)
        setContentUrl(url); setLoading(false)
      } catch {
        setFailed(true); setLoading(false)
      }
    }
    resolve()
  }, [link.url, link.siteId, link.driveId, link.itemId, canEmbed, fileType])

  const docLabel = link.label && link.label !== link.url ? link.label : 'Dokument'

  return (
    <div className={clsx(
      'flex flex-col flex-1 min-h-0',
      expanded && 'fixed inset-0 z-[60] bg-white'
    )}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={13} className="text-kimojo-red flex-shrink-0" />
          <span className="text-xs font-body font-medium text-ink-muted truncate max-w-[55vw]">
            {docLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-ink-faint"
            aria-label={expanded ? 'Verkleinern' : 'Vollbild'}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 relative bg-gray-50" style={{ WebkitOverflowScrolling: 'touch' }}>
        <AnimatePresence>
          {loading && (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50"
            >
              <Loader2 size={28} className="text-kimojo-red animate-spin" />
              <p className="text-ink-muted text-sm font-body">Dokument wird geladen…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {!loading && failed && (
          <FallbackView link={link} onRetry={() => {
            setFailed(false)
            setLoading(true)
            setIframeKey(k => k + 1)
            const retryFn = (link.siteId && link.driveId && link.itemId)
              ? getPreviewUrlDirect(link.siteId, link.driveId, link.itemId)
              : resolveEmbedUrl(link.url)
            retryFn
              .then(url => { if (url) { setContentUrl(url); setLoading(false) } else { setFailed(true); setLoading(false) } })
              .catch(() => { setFailed(true); setLoading(false) })
          }} />
        )}

        {!loading && !failed && contentUrl && (
          <>
            {/* Bilder: nativ */}
            {fileType === 'image' && (
              <div className="w-full h-full overflow-auto flex items-center justify-center p-4"
                   style={{ touchAction: 'pinch-zoom pan-x pan-y' }}>
                <img src={contentUrl} alt={docLabel} className="max-w-full max-h-full object-contain rounded-lg"
                     onError={() => setFailed(true)} />
              </div>
            )}

            {/* Videos: nativ */}
            {fileType === 'video' && (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <video src={contentUrl} controls playsInline className="max-w-full max-h-full"
                       onError={() => setFailed(true)} />
              </div>
            )}

            {/* Audio: nativ */}
            {fileType === 'audio' && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-8">
                <FileText size={48} className="text-gray-300" />
                <p className="font-display font-semibold text-ink text-base">{docLabel}</p>
                <audio src={contentUrl} controls className="w-full max-w-sm" onError={() => setFailed(true)} />
              </div>
            )}

            {/* Alles andere: iframe */}
            {!['image', 'video', 'audio'].includes(fileType) && (
              <>
                {!iframeReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 z-10">
                    <Loader2 size={28} className="text-kimojo-red animate-spin" />
                    <p className="text-ink-muted text-sm font-body">Dokument wird geladen…</p>
                  </div>
                )}
                <iframe
                  key={iframeKey}
                  ref={iframeRef}
                  src={contentUrl}
                  title={docLabel}
                  className="w-full h-full border-0 block"
                  style={{ minHeight: expanded ? '100vh' : '100%' }}
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

// ─── Fallback wenn iframe nicht lädt ─────────────────────────────────────────
function FallbackView({ link, onRetry }) {
  const docLabel = link.label && link.label !== link.url ? link.label : 'Dokument'
  const isShortLink = !canEmbedUrl(link.url)

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
        <ExternalLink size={28} className="text-kimojo-red" />
      </div>
      <div className="space-y-1.5">
        <p className="font-display font-semibold text-ink text-base">{docLabel}</p>
        <p className="text-ink-muted font-body text-sm leading-relaxed">
          {isShortLink
            ? 'Kurzlinks können nicht direkt in der App angezeigt werden. Tipp: Verwende in SharePoint direkte Dokumentlinks statt Kurzlinks.'
            : 'Dieses Dokument lässt sich nicht direkt einbetten.'}
        </p>
      </div>
      <div className="flex flex-col gap-2.5 w-full max-w-xs">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-kimojo-red text-white font-body font-semibold text-sm rounded-xl px-5 py-3 active:scale-95 transition-transform"
        >
          <ExternalLink size={15} />
          Im Browser öffnen
        </a>
        <button
          onClick={onRetry}
          className="flex items-center justify-center gap-2 bg-gray-100 text-ink-muted font-body font-medium text-sm rounded-xl px-5 py-3 active:scale-95 transition-transform"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  )
}

// ─── Prüfen ob URL direkt eingebettet werden kann ────────────────────────────
function canEmbedUrl(url) {
  if (!url) return false
  // Bekannte URL-Shortener / Redirect-Dienste blockieren iframe via X-Frame-Options
  const blockedHosts = [
    'shorturl.at', 'bit.ly', 'tinyurl.com', 't.co', 'ow.ly',
    'goo.gl', 'rb.gy', 'cutt.ly', 'short.io', 'lmy.de',
    'tiny.cc', 'is.gd', 'buff.ly', 'ift.tt', 'dlvr.it',
  ]
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (blockedHosts.some(b => host === b || host.endsWith('.' + b))) return false
  } catch {}
  return true
}

// ─── URL → Embed-URL Strategie ────────────────────────────────────────────────
async function resolveEmbedUrl(url) {
  if (!url) throw new Error('no url')
  const lower = url.toLowerCase()

  // 1. Office-Dokumente → Office Online Viewer
  if (isOfficeDoc(lower)) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
  }

  // 2. PDF – direkt im iframe
  if (lower.includes('.pdf')) return url

  // 3. Alle SharePoint-URLs → Graph Preview API
  //    Gibt eine signierte URL zurück die ohne Cookies im iframe funktioniert.
  //    Wenn null → Fallback-View zeigen (kein iframe-Versuch mit Login-URL)
  if (lower.includes('sharepoint.com')) {
    const preview = await getFileEmbedUrl(url).catch(() => null)
    if (preview) return preview
    throw new Error('sharepoint-no-embed') // → FallbackView
  }

  // 5. Alles andere → direkt versuchen
  return url
}

function isOfficeDoc(url) {
  return /\.(docx?|xlsx?|pptx?)(\?|$)/i.test(url)
}
