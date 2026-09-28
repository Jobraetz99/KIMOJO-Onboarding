import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, ExternalLink, Loader2, AlertCircle,
  CheckCircle2, Circle, Trophy,
} from 'lucide-react'
import { fetchQuizzes, fetchQuizProgress, markQuizDone, unmarkQuizDone } from '@/services/graphService'
import clsx from 'clsx'

export default function QuizView({ user }) {
  const [quizzes,  setQuizzes]  = useState([])
  const [progress, setProgress] = useState({}) // { quizId: { itemId, completedAt } }
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const displayName = user?.displayName ?? ''

  useEffect(() => {
    const email = user?.mail || user?.userPrincipalName || ''
    setLoading(true)
    Promise.all([
      fetchQuizzes(email),
      fetchQuizProgress(displayName),
    ])
      .then(([q, p]) => { setQuizzes(q); setProgress(p) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [user, displayName])

  const toggleQuiz = useCallback(async (quiz, isDone) => {
    if (isDone) {
      // Abhaken
      setProgress(prev => ({
        ...prev,
        [quiz.id]: { itemId: '__pending__', completedAt: new Date().toISOString() }
      }))
      const ok = await markQuizDone(quiz.id, quiz.title, displayName)
      if (!ok) {
        // Revert
        setProgress(prev => {
          const next = { ...prev }
          delete next[quiz.id]
          return next
        })
      } else {
        // Refresh progress to get the real itemId
        const fresh = await fetchQuizProgress(displayName)
        setProgress(fresh)
      }
    } else {
      // Wieder öffnen
      const entry = progress[quiz.id]
      if (!entry || entry.itemId === '__pending__') return
      const oldProgress = { ...progress }
      setProgress(prev => {
        const next = { ...prev }
        delete next[quiz.id]
        return next
      })
      const ok = await unmarkQuizDone(entry.itemId)
      if (!ok) setProgress(oldProgress)
    }
  }, [progress, displayName])

  const completedCount = Object.keys(progress).length
  const totalCount = quizzes.length
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const allDone = totalCount > 0 && completedCount === totalCount

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Brain size={20} className="text-purple-600" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-ink leading-tight">Quizze</h2>
              <p className="font-body text-sm text-ink-muted">
                {completedCount} von {totalCount} abgeschlossen
              </p>
            </div>
          </div>

          {/* Circle progress */}
          {totalCount > 0 && (
            <div className="relative w-14 h-14 flex-shrink-0">
              <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
                <circle cx="22" cy="22" r="18" fill="none" stroke="#F3E8FF" strokeWidth="4" />
                <motion.circle
                  cx="22" cy="22" r="18" fill="none"
                  stroke="#9333EA" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  animate={{ strokeDashoffset: `${2 * Math.PI * 18 * (1 - percent / 100)}` }}
                  initial={{ strokeDashoffset: `${2 * Math.PI * 18}` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display font-bold text-xs text-purple-600">
                {percent}%
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-purple-600 rounded-full"
              animate={{ width: `${percent}%` }}
              initial={{ width: '0%' }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
        )}
      </div>

      {/* Quiz list */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 size={24} className="text-purple-600 animate-spin" />
            <p className="text-ink-muted text-sm font-body">Quizze werden geladen...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-20 px-4 text-center">
            <AlertCircle size={28} className="text-kimojo-red" />
            <p className="font-body text-ink-muted text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && quizzes.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <Brain size={36} className="text-gray-300" />
            <p className="text-ink-muted font-body text-sm">Noch keine Quizze vorhanden.</p>
          </div>
        )}

        {/* All done celebration */}
        {!loading && allDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-2 py-4 mb-4"
          >
            <Trophy size={32} className="text-purple-600" />
            <p className="font-display font-bold text-ink text-base">Alle Quizze abgeschlossen!</p>
          </motion.div>
        )}

        <div className="flex flex-col gap-2.5">
          {quizzes.map((quiz, i) => {
            const isDone = !!progress[quiz.id]

            return (
              <motion.div
                key={quiz.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className={clsx(
                  'flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm border transition-colors',
                  isDone ? 'border-purple-200 bg-purple-50/30' : 'border-gray-100/80'
                )}
              >
                {/* Check button */}
                <button
                  onClick={() => toggleQuiz(quiz, !isDone)}
                  className="flex-shrink-0 p-0.5"
                >
                  {isDone ? (
                    <CheckCircle2 size={24} className="text-purple-600" />
                  ) : (
                    <Circle size={24} className="text-gray-300" />
                  )}
                </button>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={clsx(
                    'font-body font-semibold text-[14px] leading-snug',
                    isDone ? 'text-ink-muted line-through decoration-purple-300' : 'text-ink'
                  )}>
                    {quiz.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {quiz.standort && quiz.standort !== 'Alle' && (
                      <span className="text-[10px] font-body font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        {quiz.standort}
                      </span>
                    )}
                    {isDone && progress[quiz.id]?.completedAt && (
                      <span className="text-[10px] font-body text-ink-faint">
                        {new Date(progress[quiz.id].completedAt).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Open quiz link */}
                <a
                  href={quiz.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center active:scale-95 transition-transform"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink size={15} className="text-purple-600" />
                </a>
              </motion.div>
            )
          })}
        </div>

        <div className="h-8" />
      </div>
    </div>
  )
}
