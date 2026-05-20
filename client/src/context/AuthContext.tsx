import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { API_BASE } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id:        string
  email:     string
  name:      string | null
  avatarUrl: string | null
}

interface AuthContextType {
  user:        AuthUser | null
  token:       string | null
  loading:     boolean
  login:       (email: string, password: string) => Promise<void>
  register:    (email: string, password: string, name?: string) => Promise<void>
  logout:      () => Promise<void>
  authFetch:   (input: RequestInfo, init?: RequestInit) => Promise<Response>
  /** Merges partial updates into the local user state (call after PATCH /users/me) */
  updateUser:  (updates: Partial<AuthUser>) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'artbeat_token'
const API       = API_BASE

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null)
  const [token,   setToken]   = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY),
  )
  const [loading, setLoading] = useState(true)

  // ── Persist helpers ──────────────────────────────────────────────────────
  const persistToken = (t: string | null) => {
    if (t) {
      localStorage.setItem(TOKEN_KEY, t)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
    setToken(t)
  }

  // ── authFetch: auto-injects Bearer token ─────────────────────────────────
  const authFetch = useCallback(
    (input: RequestInfo, init: RequestInit = {}) => {
      const t = localStorage.getItem(TOKEN_KEY)
      return fetch(input, {
        ...init,
        headers: {
          ...init.headers,
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
      })
    },
    [],
  )

  // ── updateUser: merge partial updates into local state ────────────────────
  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null))
  }, [])

  // ── Rehydrate on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) { setLoading(false); return }

    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('expired')
        return r.json()
      })
      .then((u: AuthUser) => setUser(u))
      .catch(() => persistToken(null))
      .finally(() => setLoading(false))
  }, [])

  // ── Listen for Supabase OAuth sessions (Google sign-in callback) ──────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) return
        const t = session.access_token
        persistToken(t)
        const r = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${t}` },
        })
        if (r.ok) setUser(await r.json())
      },
    )
    return () => subscription.unsubscribe()
  }, [])

  // ── login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const r = await fetch(`${API}/api/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      throw new Error(body.error ?? 'Login failed')
    }
    const { token: t, user: u } = await r.json()
    persistToken(t)
    setUser(u)
  }, [])

  // ── register ──────────────────────────────────────────────────────────────
  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const r = await fetch(`${API}/api/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, name }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? 'Registration failed')
      }
      const { token: t, user: u } = await r.json()
      persistToken(t)
      setUser(u)
    },
    [],
  )

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    persistToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, authFetch, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
