import { useMsal } from '@azure/msal-react'
import { LogOut, Home, ChevronLeft } from 'lucide-react'
import { detectLocation } from '@/services/graphService'

export default function AppShell({ user, page, onNavigate, children }) {
  const { instance } = useMsal()
  const email = user?.mail || user?.userPrincipalName || ''
  const location = detectLocation(email)
  const isKitzingen = location === 'kitzingen'

  const handleLogout = () => {
    instance.logoutRedirect().catch(console.error)
  }

  const firstName = user?.displayName?.split(' ')[0] ?? ''
  const isHome = page === 'home'

  const pageTitle = {
    home: isKitzingen ? 'PfFiP' : 'KIMOJO',
    onboarding: 'Onboarding',
    quiz: 'Quizze',
    portal: isKitzingen ? 'PfFiP Teamportal' : 'KIMOJO Teamportal',
  }[page] ?? 'KIMOJO'

  const brandColor = isKitzingen ? 'bg-phfip-teal' : 'bg-kimojo-red'
  const brandLogo = isKitzingen ? '/phfip-logo.png' : '/kimojo-logo.png'
  const brandName = isKitzingen ? 'Physio & Fitness im Park' : 'KIMOJO'

  return (
    <div className="min-h-screen bg-surface-subtle flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 pt-safe">
        <div className="flex items-center justify-between h-14 max-w-2xl mx-auto w-full">
          {/* Left: Home button or logo */}
          <div className="flex items-center gap-3">
            {isHome ? (
              <>
                <img src={brandLogo} alt={brandName} className="h-8 w-auto object-contain" />
                <div>
                  <p className="font-display font-semibold text-ink text-sm leading-none">
                    Hallo, {firstName}!
                  </p>
                  <p className="text-[11px] text-ink-faint font-body">
                    {isKitzingen ? 'Physio & Fitness im Park' : 'KIMOJO Onboarding'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => onNavigate('home')}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
                  aria-label="Zurück zur Startseite"
                >
                  <ChevronLeft size={17} className="text-ink-muted" />
                </button>
                <p className="font-display font-semibold text-ink text-sm">{pageTitle}</p>
              </>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {!isHome && (
              <button
                onClick={() => onNavigate('home')}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                aria-label="Startseite"
              >
                <Home size={15} className="text-ink-muted" />
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              aria-label="Abmelden"
            >
              <LogOut size={15} className="text-ink-muted" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full flex flex-col">
        {children}
      </main>
    </div>
  )
}
