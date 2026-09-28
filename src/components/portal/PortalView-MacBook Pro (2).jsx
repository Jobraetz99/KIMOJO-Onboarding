import { ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { detectLocation } from '@/services/graphService'

export default function PortalView({ user }) {
  const email = user?.mail || user?.userPrincipalName || ''
  const location = detectLocation(email)
  const isKitzingen = location === 'kitzingen'

  const portalUrl = isKitzingen
    ? 'https://kimojophysiotherapie.sharepoint.com/sites/PfFiP-TeamPortal'
    : 'https://kimojophysiotherapie.sharepoint.com/sites/KIMOJOTeam-Portal'

  const portalName = isKitzingen ? 'PfFiP Team-Portal' : 'KIMOJO Team-Portal'
  const logo = isKitzingen ? '/phfip-logo.png' : '/kimojo-logo.png'
  const btnClass = isKitzingen
    ? 'bg-phfip-teal hover:bg-phfip-teal/90'
    : 'bg-kimojo-red hover:bg-kimojo-red/90'

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 bg-surface-subtle">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-5 text-center"
      >
        <img src={logo} alt={portalName} className="h-16 w-auto object-contain" />
        <h2 className="text-xl font-heading font-semibold text-ink-base">{portalName}</h2>
        <p className="text-ink-muted text-sm font-body max-w-xs">
          Öffne das Teamportal, um auf gemeinsame Dokumente, Neuigkeiten und Ressourcen zuzugreifen.
        </p>
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-base shadow-md transition-colors ${btnClass}`}
          style={{ touchAction: 'manipulation' }}
        >
          <ExternalLink size={18} />
          Teamportal öffnen
        </a>
      </motion.div>
    </div>
  )
}
