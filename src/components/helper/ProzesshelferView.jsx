import { useState } from 'react'
import { Bot, ExternalLink, RefreshCw } from 'lucide-react'
import { detectLocation } from '@/services/graphService'
import { PROZESSHELFER } from '@/config'

export default function ProzesshelferView({ user }) {
  const email = user?.mail || user?.userPrincipalName || ''
  const isKitzingen = detectLocation(email) === 'kitzingen'
  const helper = isKitzingen ? PROZESSHELFER.phfip : PROZESSHELFER.kimojo

  const [loaded, setLoaded] = useState(false)

  if (!helper.embedUrl) {
    return <FallbackCard helper={helper} isKitzingen={isKitzingen} />
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative flex-1">
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-subtle">
            <RefreshCw size={20} className="text-ink-faint animate-spin" />
            <p className="text-ink-muted font-body text-sm">{helper.label} wird geladen…</p>
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

      {helper.teamsUrl && (
        <div className="px-4 py-3 border-t border-gray-100 bg-white">
          <button
            onClick={() => window.open(helper.teamsUrl, '_blank', 'noopener,noreferrer')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-100 active:scale-[0.98] transition-transform"
          >
            <ExternalLink size={15} className="text-ink-muted" />
            <span className="font-body text-[13px] text-ink-muted">
              Lädt nicht? In Teams öffnen
            </span>
          </button>
        </div>
      )}
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
          Der Agent läuft aktuell in Microsoft Teams.
        </p>
      </div>
      {helper.teamsUrl && (
        <button
          onClick={() => window.open(helper.teamsUrl, '_blank', 'noopener,noreferrer')}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-ink text-white active:scale-[0.98] transition-transform"
        >
          <ExternalLink size={16} />
          <span className="font-display font-semibold text-sm">In Teams öffnen</span>
        </button>
      )}
    </div>
  )
}
