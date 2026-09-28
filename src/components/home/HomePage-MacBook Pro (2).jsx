import { motion } from 'framer-motion'
import {
  ClipboardCheck, Brain, Users, ChevronRight,
  Sparkles,
} from 'lucide-react'
import { detectLocation } from '@/services/graphService'

export default function HomePage({ user, onNavigate, completedCount, totalCount, percent, quizStats }) {
  const email = user?.mail || user?.userPrincipalName || ''
  const location = detectLocation(email)
  const firstName = user?.displayName?.split(' ')[0] ?? ''

  const isKitzingen = location === 'kitzingen'

  // Standortabhängige Konfiguration
  const brand = isKitzingen
    ? {
        name:       'Physio & Fitness im Park',
        logo:       '/phfip-logo.png',
        gradient:   'from-[#4DB8AC] via-[#3DA69B] to-[#2D8A80]',
        accent:     'text-phfip-teal',
        accentBg:   'bg-phfip-light',
        badgeBg:    'bg-phfip-light',
        badgeText:  'text-phfip-dark',
        progressBg: 'bg-white/20',
        progressBar:'bg-white',
        portalLabel:'PfFiP Teamportal',
        portalUrl:  'https://kimojophysiotherapie.sharepoint.com/sites/PfFiP-TeamPortal',
      }
    : {
        name:       'KIMOJO Physiotherapie',
        logo:       '/kimojo-logo.png',
        gradient:   'from-kimojo-red via-red-600 to-red-700',
        accent:     'text-kimojo-red',
        accentBg:   'bg-kimojo-light',
        badgeBg:    'bg-red-50',
        badgeText:  'text-kimojo-red',
        progressBg: 'bg-white/20',
        progressBar:'bg-white',
        portalLabel:'KIMOJO Teamportal',
        portalUrl:  'https://kimojophysiotherapie.sharepoint.com/sites/KIMOJOTeam-Portal',
      }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">

      {/* ── Hero Section ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`relative overflow-hidden bg-gradient-to-br ${brand.gradient} mx-4 mt-4 rounded-3xl px-6 pt-7 pb-6`}
      >
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute top-4 right-5">
          <Sparkles size={22} className="text-white/15" />
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <div className="w-auto h-10 mb-4">
            <img
              src={brand.logo}
              alt={brand.name}
              className="h-full w-auto object-contain brightness-0 invert"
            />
          </div>

          <p className="text-white/70 font-body text-sm mb-0.5">Willkommen,</p>
          <h1 className="font-display font-bold text-[26px] text-white leading-tight">
            {firstName}!
          </h1>

          {/* Mini progress in hero */}
          {totalCount > 0 && (
            <div className="mt-5 bg-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/90 font-body text-xs font-medium">Onboarding-Fortschritt</span>
                <span className="text-white font-display font-bold text-sm">{percent}%</span>
              </div>
              <div className={`h-2 ${brand.progressBg} rounded-full overflow-hidden`}>
                <motion.div
                  className={`h-full ${brand.progressBar} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Dashboard Tiles ────────────────────────────── */}
      <div className="px-4 mt-5 space-y-3 pb-8">
        <p className="text-ink-muted font-body text-xs font-medium uppercase tracking-wider px-1 mb-1">
          Bereiche
        </p>

        {/* Tile 1: Onboarding */}
        <DashboardTile
          icon={<ClipboardCheck size={24} />}
          color={brand.accentBg}
          iconColor={brand.accent}
          title="Onboarding"
          subtitle={totalCount > 0
            ? `${completedCount} von ${totalCount} Aufgaben erledigt`
            : 'Deine Aufgaben & Checkliste'
          }
          badge={totalCount > 0 ? `${percent}%` : null}
          badgeBg={brand.badgeBg}
          badgeText={brand.badgeText}
          onClick={() => onNavigate('onboarding')}
          delay={0.1}
        />

        {/* Tile 2: Quiz */}
        <DashboardTile
          icon={<Brain size={24} />}
          color="bg-purple-50"
          iconColor="text-purple-600"
          title="Quiz"
          subtitle={quizStats?.total > 0
            ? `${quizStats.done} von ${quizStats.total} abgeschlossen`
            : 'Wissen testen & spielerisch lernen'
          }
          badge={quizStats?.total > 0 ? `${Math.round((quizStats.done / quizStats.total) * 100)}%` : null}
          badgeBg="bg-purple-50"
          badgeText="text-purple-600"
          onClick={() => onNavigate('quiz')}
          delay={0.2}
        />

        {/* Tile 3: Teamportal – öffnet direkt SharePoint */}
        <DashboardTile
          icon={<Users size={24} />}
          color={isKitzingen ? 'bg-phfip-light' : 'bg-blue-50'}
          iconColor={isKitzingen ? 'text-phfip-teal' : 'text-blue-600'}
          title={brand.portalLabel}
          subtitle="Dokumente, Dateien & mehr"
          onClick={() => window.open(brand.portalUrl, '_blank', 'noopener')}
          delay={0.3}
          external
        />
      </div>
    </div>
  )
}


function DashboardTile({
  icon, color, iconColor, title, subtitle,
  badge, badgeBg = 'bg-red-50', badgeText = 'text-kimojo-red',
  onClick, external, delay = 0,
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100/80 active:scale-[0.98] transition-transform text-left"
    >
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        <span className={iconColor}>{icon}</span>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-bold text-[16px] text-ink leading-snug">{title}</h3>
          {badge && (
            <span className={`text-[11px] font-display font-bold ${badgeText} ${badgeBg} px-2 py-0.5 rounded-full`}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-ink-muted font-body text-[13px] mt-0.5 truncate">{subtitle}</p>
      </div>

      {/* Arrow */}
      <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
    </motion.button>
  )
}
