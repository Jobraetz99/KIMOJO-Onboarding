import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X } from 'lucide-react'
import { detectLocation } from '@/services/graphService'
import { PROZESSHELFER } from '@/config'
import ProzesshelferView from './ProzesshelferView'

/**
 * Prozesshelfer als Overlay, erreichbar von jeder Seite.
 *
 * Das Sheet bleibt nach dem ersten Öffnen im DOM und wird nur aus- und
 * eingeblendet – so übersteht die Unterhaltung das Schliessen, und der Agent
 * muss nicht bei jedem Öffnen neu verbinden.
 */
export default function ProzesshelferFab({ user, open, onToggle }) {
  const email = user?.mail || user?.userPrincipalName || ''
  const isKitzingen = detectLocation(email) === 'kitzingen'
  const helper = isKitzingen ? PROZESSHELFER.phfip : PROZESSHELFER.kimojo

  const [mounted, setMounted] = useState(false)
  useEffect(() => { if (open) setMounted(true) }, [open])

  if (!helper.tokenUrl && !helper.embedUrl && !helper.openUrl) return null

  const accent = isKitzingen ? 'bg-phfip-teal' : 'bg-kimojo-red'

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onToggle(false)}
            className="fixed inset-0 bg-black/40 z-40"
          />
        )}
      </AnimatePresence>

      {/* dvh statt vh: auf dem iPhone schiebt sich das Sheet sonst unter die
          Safari-Leiste und das Eingabefeld ist nicht mehr erreichbar. */}
      {mounted && (
        <div
          className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[2rem] shadow-float flex flex-col transition-transform duration-300 ${
            open ? 'translate-y-0' : 'translate-y-full pointer-events-none'
          }`}
          style={{
            height: 'min(85dvh, 44rem)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          aria-hidden={!open}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl ${accent} flex items-center justify-center`}>
                <Bot size={17} className="text-white" />
              </div>
              <p className="font-display font-semibold text-ink text-sm">{helper.label}</p>
            </div>
            <button
              onClick={() => onToggle(false)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Schliessen"
            >
              <X size={16} className="text-ink-muted" />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <ProzesshelferView user={user} />
          </div>
        </div>
      )}

      {/* Im geöffneten Zustand ausgeblendet – sonst liegt der Button über dem
          Chatverlauf. Zum Schliessen gibt es das X in der Sheet-Kopfzeile. */}
      {!open && (
        <motion.button
          onClick={
            helper.tokenUrl || helper.embedUrl
              ? () => onToggle(true)
              : () => window.open(helper.openUrl, '_blank', 'noopener,noreferrer')
          }
          whileTap={{ scale: 0.9 }}
          className={`fixed z-40 w-14 h-14 rounded-full ${accent} shadow-float flex items-center justify-center`}
          style={{ bottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1rem))', left: '1.5rem' }}
          aria-label={helper.label}
        >
          <Bot size={20} className="text-white" />
        </motion.button>
      )}
    </>
  )
}
