import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { API_BASE } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FavoritesContextType {
  /** Set of favorited event IDs — always in sync with the server when logged in */
  favoritedIds: Set<string>
  /** Returns true if the event is currently favorited */
  isFavorite:   (id: string) => boolean
  /**
   * Toggle a favorite.
   *
   * - If not logged in and `onUnauthenticated` is provided, calls it instead
   *   of the default toast — use this to redirect to /login from detail pages.
   * - If not logged in and no callback is given, shows a "Sign in" toast.
   * - Returns true if the toggle was actually performed, false otherwise.
   */
  toggle:       (id: string, onUnauthenticated?: () => void) => boolean
  /** True while the initial favorites list is being fetched on login */
  loading:      boolean
}

// ─── Context ──────────────────────────────────────────────────────────────────

const FavoritesContext = createContext<FavoritesContextType | null>(null)

const API = API_BASE

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, authFetch }         = useAuth()

  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set())
  const [loading,      setLoading]      = useState(false)

  // ── Built-in toast (for unauthenticated users) ────────────────────────────
  const [toast,        setToast]    = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    setToastVisible(true)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500)
  }, [])

  // ── Fetch favorites when user logs in; clear on logout ────────────────────
  useEffect(() => {
    if (!user) {
      setFavoritedIds(new Set())
      return
    }

    setLoading(true)
    authFetch(`${API}/api/favorites`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch favorites')
        return r.json()
      })
      .then((events: { id: string }[]) => {
        setFavoritedIds(new Set(events.map((e) => e.id)))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, authFetch])

  // ── toggle ────────────────────────────────────────────────────────────────
  const toggle = useCallback(
    (id: string, onUnauthenticated?: () => void): boolean => {
      if (!user) {
        if (onUnauthenticated) {
          onUnauthenticated()
        } else {
          showToast('Sign in to save events')
        }
        return false
      }

      const wasFavorited = favoritedIds.has(id)

      // Optimistic update
      setFavoritedIds((prev) => {
        const next = new Set(prev)
        wasFavorited ? next.delete(id) : next.add(id)
        return next
      })

      // Sync with server
      const request = wasFavorited
        ? authFetch(`${API}/api/favorites/${id}`, { method: 'DELETE' })
        : authFetch(`${API}/api/favorites`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ eventId: id }),
          })

      request.then((r) => {
        // Rollback on failure
        if (!r.ok && r.status !== 204) {
          console.warn('[favorites] sync failed — rolling back', r.status)
          setFavoritedIds((prev) => {
            const next = new Set(prev)
            wasFavorited ? next.add(id) : next.delete(id)
            return next
          })
        }
      }).catch(() => {
        // Rollback on network error
        setFavoritedIds((prev) => {
          const next = new Set(prev)
          wasFavorited ? next.add(id) : next.delete(id)
          return next
        })
      })

      return true
    },
    [user, favoritedIds, authFetch, showToast],
  )

  const isFavorite = useCallback(
    (id: string) => favoritedIds.has(id),
    [favoritedIds],
  )

  return (
    <FavoritesContext.Provider value={{ favoritedIds, isFavorite, toggle, loading }}>
      {children}

      {/* ── Global "Sign in to save" toast ─────────────────────────────── */}
      <div
        aria-live="polite"
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap transition-all duration-300 ${
          toastVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {toast}
      </div>
    </FavoritesContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Drop-in replacement for the old useFavorites() hook — same API. */
export function useFavorites(): FavoritesContextType {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used inside <FavoritesProvider>')
  return ctx
}
