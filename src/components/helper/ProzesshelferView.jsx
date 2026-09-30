import { Suspense, lazy, useCallback, useState } from 'react'
import { Bot, ExternalLink, RefreshCw } from 'lucide-react'
import { detectLocation } from '@/services/graphService'
import { PROZESSHELFER } from '@/config'

// Der Chat-Canvas bringt botframework-webchat mit (~1 MB) und wird deshalb
// erst geladen, wenn der Prozesshelfer wirklich geöffnet wird.
const CopilotChat = lazy(() => import('./CopilotChat'))

export default function ProzesshelferView({ user }) {
  const email = user?.mail || user?.userPrincipalName || ''
  const isKitzingen = detectLocation(email) === 'kitzingen'
  const helper = isKitzingen ? PROZESSHELFER.phfip : PROZESSHELFER.kimojo

  const [loaded, setLoaded] = useState(false)
  const [chatFailed, setChatFailed] = useState(false)
  const handleChatFailure = useCallback(() => setChatFailed(true), [])

  if (!helper.embedUrl && !helper.tokenUrl) {
    return <FallbackCard helper={helper} isKitzingen={isKitzingen} />
  }

  const useSso = helper.tokenUrl && !chatFailed

  return (
    // min-h-0 ist Pflicht: ohne das wächst der Chat über den Container hinaus,
    // statt in sich zu scrollen – dann ist das Eingabefeld nicht mehr erreichbar.
    <div className="flex-1 min-h-0 flex flex-col">
      {useSso ? (
        <Suspense fallback={<LoadingPane label={helper.label} />}>
          <CopilotChat helper={helper} user={user} onFailure={handleChatFailure} />
        </Suspense>
      ) : (
        <div className="relative flex-1">
          {!loaded && (
            <div className="absolute inset-0 bg-surface-subtle">
              <LoadingPane label={helper.label} />
            </div>
          )}
          <iframe
            src={helper.embedUrl}
            title={helper.label}
            onLoad={() => setLoaded(true)}
            className="w-full h-full border-0"
            allow="microphone; clipboard-write"
          />
        </div>
      )}

      {helper.openUrl && (
        <div className="px-4 py-3 border-t border-gray-100 bg-white">
          <button
            onClick={() => window.open(helper.openUrl, '_blank', 'noopener,noreferrer')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-100 active:scale-[0.98] transition-transform"
          >
            <ExternalLink size={15} className="text-ink-muted" />
            <span className="font-body text-[13px] text-ink-muted">
              Lädt nicht? In neuem Tab öffnen
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

function LoadingPane({ label }) {
  return (
    <div className="w-full h-full flex-1 flex flex-col items-center justify-center gap-3">
      <RefreshCw size={20} className="text-ink-faint animate-spin" />
      <p className="text-ink-muted font-body text-sm">{label} wird geladen…</p>
    </div>
  )
}

function FallbackCard({ helper, isKitzingen }) {
  const accentBg = isKitzingen ? 'bg-phfip-light' : 'bg-kimojo-light'
  const accent   = isKitzingen ? 'text-phfip-teal' : 'text-kimojo-red'

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className={`w-16 h-16 rounded-2xl ${accentBg} flex items-center justify-center`}>
        <Bot size={30} className={accent} />
      </div>
      <div>
        <h2 className="font-display font-bold text-[18px] text-ink">{helper.label}</h2>
        <p className="text-ink-muted font-body text-sm mt-1">
          Stell deine Frage direkt beim Agenten – er öffnet sich in einem neuen Tab.
        </p>
      </div>
      {helper.openUrl && (
        <button
          onClick={() => window.open(helper.openUrl, '_blank', 'noopener,noreferrer')}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-ink text-white active:scale-[0.98] transition-transform"
        >
          <ExternalLink size={16} />
          <span className="font-display font-semibold text-sm">Prozesshelfer öffnen</span>
        </button>
      )}
    </div>
  )
}
