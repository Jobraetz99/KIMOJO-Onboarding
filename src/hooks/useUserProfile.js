import { useState, useEffect } from 'react'
import { fetchMe } from '@/services/graphService'

export function useUserProfile() {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { user, loading, error }
}
