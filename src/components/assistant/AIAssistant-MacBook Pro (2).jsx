import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Sparkles, FileText, ExternalLink, Loader2 } from 'lucide-react'
import { AI_CONFIG } from '@/config'
import { detectLocation, searchSharePoint, getFileEmbedUrl } from '@/services/graphService'
import clsx from 'clsx'

export default function AIAssistant({ user, tasks = [], completedCount = 0, totalCount = 0, documents = [] }) {
  const [open,      setOpen]      = useState(false)
  const [messages,  setMessages]  = useState([])  // [{ role, content, docs? }]
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [docViewer, setDocViewer] = useState(null) // { url, name } | null
  const endRef   = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hallo ${user?.displayName?.split(' ')[0] ?? ''}! Ich bin dein KIMOJO Onboarding-Assistent.\n\nIch kann Fragen zu deinen Prozessen, Dokumenten und dem Arbeitsalltag beantworten — direkt aus eurem SharePoint.`,
      }])
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const email = user?.mail || user?.userPrincipalName || ''

      // 1. SharePoint nach relevanten Inhalten durchsuchen
      const searchResults = await searchSharePoint(text, email).catch(() => [])

      // 2. Claude mit echten Snippets + Dokumentliste als Kontext aufrufen
      const { reply, docs } = await callClaude([...messages, userMsg], tasks, user, searchResults, documents)

      setMessages(prev => [...prev, { role: 'assistant', content: reply, docs }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Entschuldigung, da ist etwas schiefgelaufen: ${e.message}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const openDoc = async (url, name) => {
    setDocViewer({ url: null, name, loading: true })
    const embedUrl = await getFileEmbedUrl(url).catch(() => null)
    if (embedUrl) {
      setDocViewer({ url: embedUrl, name, loading: false })
    } else {
      // Fallback: im Browser öffnen
      window.open(url, '_blank')
      setDocViewer(null)
    }
  }

  return (
    <>
      {/* ── Dokument-Viewer ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {docViewer && (
          <>
            <motion.div
              key="dv-bg"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[60]"
              onClick={() => setDocViewer(null)}
            />
            <motion.div
              key="dv-panel"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[70] bg-white rounded-t-[1.75rem] flex flex-col"
              style={{ height: '88vh' }}
            >
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 flex-shrink-0">
                <FileText size={16} className="text-kimojo-red flex-shrink-0" />
                <p className="flex-1 font-body text-sm font-medium text-ink truncate">{docViewer.name}</p>
                <button
                  onClick={() => setDocViewer(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <X size={15} className="text-ink-muted" />
                </button>
              </div>
              <div className="flex-1 relative">
                {docViewer.loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={28} className="text-kimojo-red animate-spin" />
                  </div>
                ) : (
                  <iframe
                    src={docViewer.url}
                    className="w-full h-full border-0"
                    title={docViewer.name}
                  />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Chat-Panel ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="bd"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="panel"
              initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[2rem] flex flex-col"
              style={{ maxHeight: '80vh' }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
                <div className="w-9 h-9 rounded-2xl bg-kimojo-red flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-display font-semibold text-ink text-sm">KIMOJO Assistent</p>
                  <p className="text-[11px] text-ink-faint font-body">Powered by SharePoint + Claude AI</p>
                </div>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <X size={16} className="text-ink-muted" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 no-scrollbar">
                {messages.map((m, i) => (
                  <Bubble key={i} role={m.role} content={m.content} docs={m.docs} onOpenDoc={openDoc} />
                ))}
                {loading && <SearchingIndicator />}
                <div ref={endRef} />
              </div>

              {/* Quick suggestions */}
              {messages.length === 1 && (
                <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus() }}
                      className="flex-shrink-0 text-xs font-body bg-kimojo-light text-kimojo-red border border-kimojo-muted rounded-full px-3 py-1.5 whitespace-nowrap"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-4 pb-safe pb-6 pt-2 border-t border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-4 py-2.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                    placeholder="Stell mir eine Frage…"
                    className="flex-1 bg-transparent font-body text-[15px] text-ink outline-none placeholder:text-gray-400"
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim() || loading}
                    className={clsx(
                      'w-8 h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
                      input.trim() && !loading ? 'bg-kimojo-red text-white' : 'bg-gray-200 text-gray-400'
                    )}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileTap={{ scale: 0.9 }}
        className="fixed z-30 w-14 h-14 rounded-full bg-kimojo-red shadow-float flex items-center justify-center"
        style={{ bottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1rem))', right: '1.5rem' }}
        aria-label="KI-Assistent"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x"  initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X size={22} className="text-white" /></motion.span>
            : <motion.span key="ai" initial={{ rotate:  90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><Sparkles size={20} className="text-white" /></motion.span>
          }
        </AnimatePresence>
      </motion.button>
    </>
  )
}

// ─── Claude API call ──────────────────────────────────────────────────────────
async function callClaude(messages, tasks = [], user = null, searchResults = [], documents = []) {
  const { apiKey, proxyUrl, model } = AI_CONFIG

  const email    = user?.mail || user?.userPrincipalName || ''
  const location = detectLocation(email)
  const standort =
    location === 'werneck'   ? 'Werneck (KIMOJO Therapiezentrum)'      :
    location === 'kitzingen' ? 'Kitzingen (Physio und Fitness im Park)' :
    'unbekannt'

  // ── Systemprompt ─────────────────────────────────────────────────────────────
  const baseSystem = `Du bist der KIMOJO Onboarding-Assistent für ${user?.displayName ?? 'neue Mitarbeiter'} (Standort: ${standort}).

Du hast Zugriff auf die echten SharePoint-Dokumente des Unternehmens. Wenn Suchergebnisse mit Dokumentinhalt bereitgestellt werden, nutze diese um präzise, konkrete Antworten zu geben.

REGELN:
1. PRIORITÄT 1: Wenn echte Dokumentinhalte vorliegen, beantworte die Frage DIREKT daraus. Zitiere relevante Passagen und nenne das Quelldokument.
2. Wenn du Ordnerpfade kennst, sage dem Mitarbeiter WO er das Dokument findet (z.B. "Das findest du im Dokument 'Arbeitszeiten.docx' unter Standardprozesse").
3. Wenn du nichts Passendes findest: "Das habe ich in euren Dokumenten nicht gefunden. Frag am besten deinen Ansprechpartner."
4. Erfinde NIEMALS Informationen. Alles was du sagst muss aus den bereitgestellten Dokumenten stammen.
5. Antworte auf Deutsch, freundlich, strukturiert und hilfreich.
6. Bei langen Dokumentinhalten: Fasse die relevanten Teile zusammen, nicht alles wiedergeben.`

  // ── Aufgaben-Kontext ──────────────────────────────────────────────────────────
  const openTasks = tasks.filter(t => t.status !== 'Erledigt')
  const doneTasks = tasks.filter(t => t.status === 'Erledigt')
  const taskContext = tasks.length > 0 ? `

═══ ONBOARDING-AUFGABEN ═══
Fortschritt: ${doneTasks.length}/${tasks.length} erledigt
Offen: ${openTasks.map(t => t.title).join(', ')}` : ''

  // ── SharePoint-Suchergebnisse (echte Textinhalte aus Dokumenten) ────────────
  let searchContext = ''
  if (searchResults.length > 0) {
    // Ergebnisse mit echtem Inhalt priorisieren
    const withContent = searchResults.filter(r => r.fullContent)
    const withSnippet = searchResults.filter(r => !r.fullContent && r.snippet)

    const parts = []

    if (withContent.length > 0) {
      parts.push(`Die folgenden Dokumente wurden gefunden und der VOLLSTÄNDIGE INHALT wurde extrahiert:

${withContent.map((r, i) =>
  `━━━ [${i + 1}] "${r.name}" ━━━\n${r.fullContent}`
).join('\n\n')}`)
    }

    if (withSnippet.length > 0) {
      parts.push(`Weitere Treffer (nur Vorschau verfügbar):
${withSnippet.map((r, i) =>
  `[${withContent.length + i + 1}] "${r.name}": ${r.snippet}`
).join('\n')}`)
    }

    searchContext = `

═══ SHAREPOINT-SUCHERGEBNISSE ═══
${parts.join('\n\n')}

WICHTIG: Beantworte die Frage DIREKT basierend auf dem Dokumentinhalt oben. Zitiere relevante Stellen. Nenne immer den Dokumentnamen als Quelle.`
  }

  // ── Dokumentliste mit Ordnerstruktur ────────────────────────────────────────
  let docListContext = ''
  if (documents.length > 0) {
    const bySite = {}
    documents.forEach(d => {
      const s = d.site ?? 'Allgemein'
      if (!bySite[s]) bySite[s] = []
      // Zeige den vollständigen Pfad, damit die AI die Ordnerstruktur versteht
      const icon = d.isFile ? '📄' : '📁'
      bySite[s].push(`${icon} ${d.path ?? d.name}`)
    })
    const fileCount = documents.filter(d => d.isFile).length
    const folderCount = documents.filter(d => !d.isFile).length
    docListContext = `

═══ SHAREPOINT-ORDNERSTRUKTUR (${fileCount} Dateien, ${folderCount} Ordner) ═══
Nutze diese Struktur um dem Mitarbeiter zu sagen WO er das richtige Dokument findet.
Verweise auf den Ordnerpfad (z.B. "Schau unter Standardprozesse > Behandlungsablauf > 1. Termin").

${Object.entries(bySite).map(([site, items]) =>
  `[${site}]:\n${items.map(n => `  ${n}`).join('\n')}`
).join('\n\n')}`
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  const endpoint = proxyUrl || 'https://api.anthropic.com/v1/messages'
  const headers  = {
    'Content-Type': 'application/json',
    ...(apiKey && !proxyUrl ? {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
    } : {}),
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: baseSystem + taskContext + searchContext + docListContext,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `API-Fehler ${res.status}`)
  }

  const data  = await res.json()
  const reply = data.content?.[0]?.text ?? 'Keine Antwort erhalten.'

  // Nur Dokumente als Karten zeigen die die AI in ihrer Antwort auch erwähnt
  // Checke ob der Dateiname oder Teile davon im Antworttext vorkommen
  const replyLower = reply.toLowerCase()
  const seen = new Set()

  // Prüfe Suchergebnisse
  const matchedDocs = searchResults.filter(r => {
    if (seen.has(r.name)) return false
    // Dateiname ohne Endung
    const baseName = r.name.replace(/\.\w+$/, '').toLowerCase()
    // Prüfe ob Teile des Namens (mind. 5 Zeichen) in der Antwort vorkommen
    const parts = baseName.split(/[-_\s]+/).filter(p => p.length >= 5)
    const mentioned = parts.some(p => replyLower.includes(p)) || replyLower.includes(baseName)
    if (mentioned) seen.add(r.name)
    return mentioned
  }).slice(0, 3)

  // Zusätzlich: Ordner/Dateien aus der Dokumentliste die in der Antwort erwähnt werden
  const matchedFromTree = documents
    .filter(d => d.isFile && !seen.has(d.name))
    .filter(d => {
      const baseName = d.name.replace(/\.\w+$/, '').toLowerCase()
      const parts = baseName.split(/[-_\s]+/).filter(p => p.length >= 5)
      return parts.some(p => replyLower.includes(p)) || replyLower.includes(baseName)
    })
    .map(d => ({ name: d.name, url: d.url, snippet: '' }))
    .slice(0, 2)

  const docs = [...matchedDocs, ...matchedFromTree]

  return { reply, docs }
}

// ─── Bubble ───────────────────────────────────────────────────────────────────
function Bubble({ role, content, docs = [], onOpenDoc }) {
  return (
    <div className={clsx('flex flex-col gap-2', role === 'user' ? 'items-end' : 'items-start')}>
      <div className={clsx(
        'max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] font-body leading-relaxed whitespace-pre-wrap',
        role === 'user'
          ? 'bg-kimojo-red text-white rounded-br-sm'
          : 'bg-gray-100 text-ink rounded-bl-sm'
      )}>
        {content}
      </div>

      {/* Dokument-Karten */}
      {role === 'assistant' && docs.length > 0 && (
        <div className="flex flex-col gap-1.5 w-full max-w-[85%]">
          <p className="text-[11px] font-body text-ink-faint px-1">📎 Quellen aus SharePoint:</p>
          {docs.map((doc, i) => (
            <button
              key={i}
              onClick={() => onOpenDoc(doc.url, doc.name)}
              className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-left active:bg-gray-50 transition-colors w-full"
            >
              <div className="w-7 h-7 rounded-lg bg-kimojo-light flex items-center justify-center flex-shrink-0">
                <FileText size={13} className="text-kimojo-red" />
              </div>
              <span className="flex-1 text-[13px] font-body font-medium text-ink truncate">{doc.name}</span>
              <ExternalLink size={12} className="text-ink-faint flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SearchingIndicator() {
  return (
    <div className="self-start flex flex-col gap-1.5">
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
            />
          ))}
        </div>
      </div>
      <p className="text-[11px] font-body text-ink-faint px-1">Durchsuche SharePoint…</p>
    </div>
  )
}

const SUGGESTIONS = [
  'Was muss ich am ersten Tag mitbringen?',
  'Wie beantrage ich Urlaub?',
  'Wie funktioniert die Zeiterfassung?',
  'Was ist die Kleiderordnung?',
]
