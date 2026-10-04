import { useCallback, useState } from 'react'
import { api } from '../lib/api'

const STORAGE_KEY = 'mlinzi.session'

// Storage can be unavailable (private windows, blocked site data): never let that break the app
function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null
  } catch {
    return null
  }
}

function saveSession(session) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // keep the session in memory only
  }
}

// Logged-in staff session: { token, user } or null
export function useAuth() {
  const [session, setSession] = useState(loadSession)

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password)
    const next = { token: res.access_token, user: res.user }
    saveSession(next)
    setSession(next)
  }, [])

  const logout = useCallback(() => {
    saveSession(null)
    setSession(null)
  }, [])

  return { session, login, logout }
}
