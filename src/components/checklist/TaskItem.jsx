import { motion } from 'framer-motion'
import { CheckCircle2, Circle, ChevronRight, Link as LinkIcon, User } from 'lucide-react'
import clsx from 'clsx'
import { SP_STATUS } from '@/config'

export default function TaskItem({ task, onToggle, onClick }) {
  const done = task.status === SP_STATUS.erledigt

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl px-4 py-3.5 flex items-start gap-3 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => onClick?.(task)}
    >
      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onToggle?.(task.id, !done) }}
        className="flex-shrink-0 mt-0.5"
        aria-label={done ? 'Als offen markieren' : 'Als erledigt markieren'}
      >
        {done
          ? <CheckCircle2 size={22} className="text-kimojo-red" />
          : <Circle       size={22} className="text-gray-300" />
        }
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className={clsx(
          'font-body font-medium text-[15px] block leading-snug break-words whitespace-normal',
          done ? 'line-through text-ink-faint' : 'text-ink'
        )}>
          {task.title}
        </span>

        <div className="flex flex-wrap items-center gap-x-3 mt-1">
          {task.mitarbeiterName && (
            <span className="text-xs text-ink-faint font-body flex items-center gap-0.5">
              <User size={10} className="text-kimojo-red" />
              {task.mitarbeiterName}
            </span>
          )}
          {task.faelligkeit && (
            <span className="text-xs text-ink-faint font-body">
              {task.faelligkeit.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
            </span>
          )}
          {task.relevantLink && (
            <span className="text-xs text-kimojo-red font-body flex items-center gap-0.5">
              <LinkIcon size={10} />
              Link
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={16} className="flex-shrink-0 text-gray-300 mt-1" />
    </motion.div>
  )
}
