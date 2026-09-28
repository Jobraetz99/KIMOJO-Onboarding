import { useMsal } from '@azure/msal-react'
import { loginRequest } from '@/services/authConfig'
import { LogIn } from 'lucide-react'

export default function LoginScreen() {
  const { instance } = useMsal()

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch(console.error)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-surface-subtle px-6">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-3xl bg-kimojo-red flex items-center justify-center shadow-float">
          <span className="font-display font-bold text-white text-3xl">K</span>
        </div>
        <div className="text-center">
          <h1 className="font-display font-bold text-2xl text-ink">KIMOJO Onboarding</h1>
          <p className="text-ink-muted font-body text-sm mt-1">Willkommen! Bitte melde dich an.</p>
        </div>
      </div>

      {/* Login Button */}
      <button
        onClick={handleLogin}
        className="flex items-center gap-3 bg-kimojo-red text-white font-body font-semibold px-8 py-4 rounded-2xl shadow-float active:scale-95 transition-transform"
      >
        <LogIn size={20} />
        Mit Microsoft anmelden
      </button>

      <p className="text-xs text-ink-faint font-body text-center max-w-xs">
        Melde dich mit deinem KIMOJO Microsoft-Konto an, um deine Onboarding-Aufgaben zu sehen.
      </p>
    </div>
  )
}
