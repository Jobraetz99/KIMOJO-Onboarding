import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, AlertCircle, CheckCircle2, ClipboardList } from 'lucide-react'
import { useChecklist } from '@/hooks/useChecklist'
import { SP_STATUS } from '@/config'
import TaskItem   from './TaskItem'
import TaskDetail from './TaskDetail'

export default function ChecklistView({ user }) {
  const { tasks, loading, error, toggle, updateDate, reload, completedCount, totalCount, percent } =
    useChecklist(user)

  const [selectedTask, setSelectedTask] = useState(null)
  const [filter, setFilter]             = useState('all') // 'all' | 'open' | 'done'

  const filtered = tasks.filter(t => {
    if (filter === 'open') return t.status !== SP_STATUS.erledigt
    if (filter === 'done') return t.status === SP_STATUS.erledigt
    return true
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Progress header ──────────────────────────── */}
      <div className="px-5 pt-4 pb-3 bg-white border-b border-gray-100 flex-shrink-0">

        {/* Ring + counter */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display font-bold text-xl text-ink leading-tight">
              Deine Aufgaben
            </h2>
            <p className="font-body text-sm text-ink-muted mt-0.5">
              {completedCount} von {totalCount} erledigt
            </p>
          </div>

          {/* Circle progress */}
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#F5E8E8" strokeWidth="4" />
              <motion.circle
                cx="22" cy="22" r="18" fill="none"
                stroke="#BF3B36" strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 18}`}
                animate={{ strokeDashoffset: `${2 * Math.PI * 18 * (1 - percent / 100)}` }}
                initial={{ strokeDashoffset: `${2 * Math.PI * 18}` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display font-bold text-xs text-kimojo-red">
              {percent}%
            </span>
          </div>
        </div>

        {/* Linear bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-kimojo-red rounded-full"
            animate={{ width: `${percent}%` }}
            initial={{ width: '0%' }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {[
            { key: 'all',  label: 'Alle' },
            { key: 'open', label: 'Offen' },
            { key: 'done', label: 'Erledigt' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`text-xs font-body font-medium px-3.5 py-1.5 rounded-full transition-all ${
                filter === tab.key
                  ? 'bg-kimojo-red text-white'
                  : 'bg-gray-100 text-ink-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Task list ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4">

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <RefreshCw size={24} className="text-kimojo-red animate-spin" />
            <p className="text-ink-muted text-sm font-body">Checkliste wird geladen…</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-20 px-4 text-center">
            <AlertCircle size={28} className="text-kimojo-red" />
            <p className="font-body text-ink-muted text-sm leading-relaxed">{error}</p>
            <button
              onClick={reload}
              className="mt-1 bg-kimojo-red text-white font-body font-medium text-sm rounded-xl px-5 py-2.5 active:scale-95 transition-transform"
            >
              Erneut versuchen
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            {filter === 'done' && totalCount > 0 ? (
              <>
                <ClipboardList size={32} className="text-gray-300" />
                <p className="text-ink-muted font-body text-sm">Noch nichts erledigt.</p>
              </>
            ) : filter === 'open' && completedCount === totalCount && totalCount > 0 ? (
              <>
                <CheckCircle2 size={36} className="text-kimojo-red" />
                <p className="font-display font-bold text-ink text-lg">Alles erledigt!</p>
                <p className="text-ink-muted font-body text-sm">Herzlichen Glückwunsch zum erfolgreichen Onboarding.</p>
              </>
            ) : (
              <>
                <ClipboardList size={32} className="text-gray-300" />
                <p className="text-ink-muted font-body text-sm">Keine Aufgaben gefunden.</p>
              </>
            )}
          </div>
        )}

        <AnimatePresence>
          {!loading && !error && (
            <motion.div className="flex flex-col gap-2.5">
              {filtered.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onClick={setSelectedTask}
                  onToggle={toggle}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Spacer for FAB */}
        <div className="h-24" />
      </div>

      {/* Task detail sheet */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetail
            key={selectedTask.id}
            task={tasks.find(t => t.id === selectedTask.id) ?? selectedTask}
            onToggle={toggle}
            onDateChange={updateDate}
            onClose={() => setSelectedTask(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
