import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import EventCard, { EventCardData } from '../components/EventCard'
import CitySelector from '../components/CitySelector'
import { SkeletonGrid } from '../components/Skeleton'
import { useAuth }      from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { useToast }     from '../context/ToastContext'
import { useTitle }     from '../hooks/useTitle'
import { API_BASE }     from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type FavoriteEvent = EventCardData & { startDate: string }

// ─── Pull-to-refresh indicator ────────────────────────────────────────────────

function PullIndicator({ distance, refreshing }: { distance: number; refreshing: boolean }) {
  if (distance === 0 && !refreshing) return null
  const THRESHOLD = 60
  const opacity   = Math.min((distance / THRESHOLD) * 2, 1)
  return (
    <div
      className="absolute left-0 right-0 z-10 flex justify-center pointer-events-none"
      style={{ top: `${distance - 48}px`, opacity }}
    >
      <div className={`w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
        <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SignInPrompt() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] px-8 text-center">
      <svg className="w-28 h-28 mb-6 opacity-30" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <circle cx="60" cy="60" r="56" stroke="#6B7280" strokeWidth="2" strokeDasharray="6 4" />
        <path d="M60 80C60 80 30 62 30 44a18 18 0 0136 0 18 18 0 0136 0C102 62 60 80 60 80z" fill="#E5E7EB" />
      </svg>
      <h1 className="text-xl font-bold text-gray-800 mb-2">Save your favourites</h1>
      <p className="text-sm text-gray-400 max-w-xs mb-8 leading-relaxed">
        Sign in to save events and exhibitions you want to attend. They'll be waiting for you here.
      </p>
      <button
        onClick={() => navigate('/login?redirect=/favorites')}
        className="w-full max-w-xs h-12 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-colors"
      >
        Sign in
      </button>
      <button
        onClick={() => navigate('/register?redirect=/favorites')}
        className="w-full max-w-xs h-12 mt-3 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
      >
        Create account
      </button>
    </div>
  )
}

function EmptyState() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] px-8 text-center">
      <svg className="w-24 h-24 mb-6 opacity-25" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <path d="M60 95C60 95 20 70 20 44a28 28 0 0156 0 28 28 0 0156 0C132 70 60 95 60 95z" stroke="#6B7280" strokeWidth="3" strokeLinejoin="round" />
        <path d="M40 50h40M40 60h28" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <h1 className="text-xl font-bold text-gray-800 mb-2">No saved events yet</h1>
      <p className="text-sm text-gray-400 max-w-xs mb-8 leading-relaxed">
        Tap the heart on any event to save it here so you never miss it.
      </p>
      <button
        onClick={() => navigate('/discover')}
        className="px-8 h-12 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-colors"
      >
        Start exploring
      </button>
    </div>
  )
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-5 pb-2">
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{count}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FavoritesPage() {
  const { user, loading: authLoading, authFetch } = useAuth()
  const { toggle, loading: favLoading }           = useFavorites()
  const { showToast }                             = useToast()

  useTitle('Saved', 'Your saved art events and exhibitions.')

  const [events,       setEvents]       = useState<FavoriteEvent[]>([])
  const [dataLoading,  setDataLoading]  = useState(false)
  const [pastExpanded, setPastExpanded] = useState(false)

  // Pull-to-refresh
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing,   setRefreshing]   = useState(false)
  const touchStartY = useRef(0)
  const isPulling   = useRef(false)
  const PULL_THRESHOLD = 60
  const scrollRef      = useRef<HTMLDivElement>(null)
  const lastScrollY    = useRef(0)

  const API = API_BASE

  // ── Fetch favourites ────────────────────────────────────────────────────
  const fetchFavorites = useCallback(async () => {
    if (!user) return
    setDataLoading(true)
    try {
      const data: FavoriteEvent[] = await authFetch(`${API}/api/favorites`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      setEvents(data)
    } catch {
      showToast('Failed to load saved events.', 'error')
    } finally {
      setDataLoading(false)
    }
  }, [user, authFetch, API, showToast])

  useEffect(() => { fetchFavorites() }, [fetchFavorites])

  // ── Pull-to-refresh ─────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((scrollRef.current?.scrollTop ?? 1) > 0) return
    touchStartY.current = e.touches[0].clientY
    isPulling.current   = true
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) setPullDistance(Math.min(delta * 0.5, 100))
  }, [])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return
    isPulling.current = false
    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true)
      await fetchFavorites()
      setRefreshing(false)
    }
    setPullDistance(0)
  }, [pullDistance, fetchFavorites])

  // ── Scroll direction → nav visibility ──────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const y = el.scrollTop
    if (y > lastScrollY.current + 8)      window.dispatchEvent(new CustomEvent('nav:hide'))
    else if (y < lastScrollY.current - 8) window.dispatchEvent(new CustomEvent('nav:show'))
    lastScrollY.current = y
  }, [])

  useEffect(() => () => { window.dispatchEvent(new CustomEvent('nav:show')) }, [])

  // ── Guards ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-4rem)]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" aria-label="Loading" />
      </div>
    )
  }
  if (!user)                      return <SignInPrompt />
  if (favLoading || dataLoading)  return <SkeletonGrid count={6} />

  const now      = new Date()
  const upcoming = events.filter((e) => new Date(e.startDate) >= now)
  const past     = events.filter((e) => new Date(e.startDate) < now)

  if (events.length === 0) return <EmptyState />

  return (
    <div
      ref={scrollRef}
      className="bg-gray-50 min-h-[calc(100dvh-4rem)] pb-8 overflow-y-auto relative"
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <PullIndicator distance={pullDistance} refreshing={refreshing} />

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="px-4 pt-6 pb-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="mt-1">
          <CitySelector variant="row" />
        </div>
      </div>

      {/* ── Coming up ─────────────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <>
          <SectionHeading label="Coming up" count={upcoming.length} />
          <div className="grid grid-cols-2 gap-3 px-4">
            {upcoming.map((event) => (
              <div key={event.id} className="relative">
                <EventCard event={event} />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(event.id)
                    setEvents((prev) => prev.filter((ev) => ev.id !== event.id))
                  }}
                  aria-label={`Remove "${event.title}" from saved`}
                  className="absolute top-1 left-1 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-gray-900/60 text-white hover:bg-gray-900/80 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Past events ───────────────────────────────────────────────── */}
      {past.length > 0 && (
        <>
          <button
            onClick={() => setPastExpanded((v) => !v)}
            aria-expanded={pastExpanded}
            className="w-full flex items-center gap-2 px-4 pt-5 pb-2 text-left min-h-[44px]"
          >
            <span className="text-sm font-bold text-gray-500">Past events</span>
            <span className="text-xs font-semibold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{past.length}</span>
            <svg
              className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${pastExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {pastExpanded && (
            <div className="grid grid-cols-2 gap-3 px-4">
              {past.map((event) => (
                <div key={event.id} className="relative opacity-70">
                  <EventCard event={event} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggle(event.id)
                      setEvents((prev) => prev.filter((ev) => ev.id !== event.id))
                    }}
                    aria-label={`Remove "${event.title}" from saved`}
                    className="absolute top-1 left-1 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-gray-900/60 text-white hover:bg-gray-900/80 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs font-semibold text-center py-1 rounded-b-2xl pointer-events-none">
                    Past event
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
