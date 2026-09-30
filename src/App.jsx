import { useState, useEffect } from 'react'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { RefreshCw } from 'lucide-react'
import { fetchMe, fetchQuizzes, fetchQuizProgress } from '@/services/graphService'
import { loginRequest } from '@/services/authConfig'
import { useChecklist } from '@/hooks/useChecklist'

import LoginScreen   from '@/components/auth/LoginScreen'
import AppShell      from '@/components/layout/AppShell'
import HomePage      from '@/components/home/HomePage'
import ChecklistView from '@/components/checklist/ChecklistView'
import QuizView      from '@/components/quiz/QuizView'
import PortalView    from '@/components/portal/PortalView'
import ProzesshelferFab from '@/components/helper/ProzesshelferFab'

export default function App() {
  const isAuthenticated = useIsAuthenticated()
  const { inProgress }  = useMsal()
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!isAuthenticated) { setUser(null); return }
    setLoading(true)
    setError(null)
    fetchMe()
      .then(setUser)
      .catch(err => { console.error(err); setError(err) })
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  if (inProgress !== InteractionStatus.None && !isAuthenticated) {
    return <LoadingScreen message="Anmeldung läuft…" />
  }

  if (!isAuthenticated) return <LoginScreen />
  if (error) return <ErrorScreen error={error} />
  if (loading || !user) return <LoadingScreen message="Profil laden…" />

  return <AuthenticatedApp user={user} />
}

function AuthenticatedApp({ user }) {
  const [page, setPage] = useState('home') // 'home' | 'onboarding' | 'quiz' | 'portal'
  const [helperOpen, setHelperOpen] = useState(false)
  const { completedCount, totalCount, percent, reload: reloadChecklist } = useChecklist(user)
  const [quizStats, setQuizStats] = useState({ total: 0, done: 0 })

  const email = user?.mail || user?.userPrincipalName || ''
  const displayName = user?.displayName ?? ''

  // Quiz + Onboarding stats laden/refreshen wenn Home-Seite angezeigt wird
  useEffect(() => {
    if (page === 'home') {
      Promise.all([
        fetchQuizzes(email),
        fetchQuizProgress(displayName),
      ]).then(([quizzes, progress]) => {
        setQuizStats({ total: quizzes.length, done: Object.keys(progress).length })
      }).catch(() => {})
      // Auch Checkliste refreshen
      reloadChecklist()
    }
  }, [page, email, displayName, reloadChecklist])

  return (
    <AppShell user={user} page={page} onNavigate={setPage}>
      {page === 'home' && (
        <HomePage
          user={user}
          onNavigate={setPage}
          completedCount={completedCount}
          totalCount={totalCount}
          percent={percent}
          quizStats={quizStats}
          onOpenHelper={() => setHelperOpen(true)}
        />
      )}
      {page === 'onboarding' && (
        <ChecklistView user={user} />
      )}
      {page === 'quiz' && (
        <QuizView user={user} />
      )}
      {page === 'portal' && (
        <PortalView user={user} />
      )}
      <ProzesshelferFab user={user} open={helperOpen} onToggle={setHelperOpen} />
    </AppShell>
  )
}

function ErrorScreen({ error }) {
  const { instance } = useMsal()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center bg-surface-subtle">
      <div className="w-14 h-14 rounded-3xl bg-kimojo-red flex items-center justify-center shadow-float">
        <span className="font-display font-bold text-white text-xl">K</span>
      </div>
      <div>
        <h1 className="font-display font-bold text-ink text-[17px]">Profil konnte nicht geladen werden</h1>
        <p className="text-ink-muted font-body text-sm mt-1.5">
          Meistens hilft eine neue Anmeldung.
        </p>
        <p className="text-ink-faint font-body text-xs mt-3 break-words">
          {error?.errorCode || error?.message || String(error)}
        </p>
      </div>
      <button
        onClick={() => instance.loginRedirect(loginRequest).catch(console.error)}
        className="px-5 py-3 rounded-xl bg-ink text-white font-display font-semibold text-sm active:scale-[0.98] transition-transform"
      >
        Neu anmelden
      </button>
    </div>
  )
}

function LoadingScreen({ message }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface-subtle">
      <div className="w-14 h-14 rounded-3xl bg-kimojo-red flex items-center justify-center shadow-float">
        <span className="font-display font-bold text-white text-xl">K</span>
      </div>
      <RefreshCw size={20} className="text-kimojo-red animate-spin" />
      <p className="text-ink-muted font-body text-sm">{message}</p>
    </div>
  )
}
