import { useState, useEffect, useCallback } from 'react'
import { fetchChecklist, updateTaskStatus, updateTaskDate } from '@/services/graphService'
import { SP_STATUS } from '@/config'

export function useChecklist(user) {
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const email = user.mail || user.userPrincipalName || ''
      const name  = user.displayName || ''
      const items = await fetchChecklist(email, name)
      setTasks(items)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const toggle = useCallback(async (taskId, done) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, status: done ? SP_STATUS.erledigt : SP_STATUS.offen }
        : t
    ))
    try {
      await updateTaskStatus(taskId, done)
    } catch (e) {
      // Revert on error
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: done ? SP_STATUS.offen : SP_STATUS.erledigt }
          : t
      ))
    }
  }, [])

  const updateDate = useCallback(async (taskId, isoDate) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, faelligkeit: isoDate ? new Date(isoDate) : null }
        : t
    ))
    await updateTaskDate(taskId, isoDate)
  }, [])

  const completedCount = tasks.filter(t => t.status === SP_STATUS.erledigt).length
  const totalCount     = tasks.length
  const percent        = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return { tasks, loading, error, toggle, updateDate, completedCount, totalCount, percent, reload: load }
}
