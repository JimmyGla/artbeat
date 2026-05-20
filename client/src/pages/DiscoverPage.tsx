import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import EventCard, { EventCardData } from '../components/EventCard'
import VenueCard, { VenueCardData } from '../components/VenueCard'
import CitySelector  from '../components/CitySelector'
import { SkeletonGrid, SkeletonList } from '../components/Skeleton'
import { useCity }   from '../context/CityContext'
import { useToast }  from '../context/ToastContext'
import { useDebounce } from '../hooks/useDebounce'
import { useTitle }  from '../hooks/useTitle'
import { MemCache }  from '../lib/memCache'
import { API_BASE }  from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryData { id: string; name: string; slug: string; color: string }
type DateFilter = 'today' | 'week' | 'month' | 'all'
type ViewTab    = 'events' | 'venues'

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'today', label: 'Today'      },
  { key: 'week',  label: 'This week'  },
  { key: 'month', label: 'This month' },
  { key: 'all',   label: 'All'        },
]

const API = API_BASE

// ─── Module-level cache (survives re-renders, expires after 5 min) ────────────

const eventsCache = new MemCache<EventCardData[]>()
const venuesCache = new MemCache<VenueCardData[]>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateRange(filter: DateFilter): { dateFrom?: string; dateTo?: string } {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (filter) {
    case 'today': {
      const end = new Date(today); end.setHours(23, 59, 59, 999)
      return { dateFrom: today.toISOString(), dateTo: end.toISOString() }
    }
    case 'week': {
      const end = new Date(today); end.setDate(today.getDate() + 7)
      return { dateFrom: today.toISOString(), dateTo: end.toISOString() }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      return { dateFrom: start.toISOString(), dateTo: end.toISOString() }
    }
    default: return {}
  }
}

function buildEventsCacheKey(slug: string, category: string | null, dateFilter: DateFilter): string {
  return `${slug}:${category ?? ''}:${dateFilter}`
}

// ─── Pull-to-refresh indicator ────────────────────────────────────────────────

function PullIndicator({ distance, refreshing }: { distance: number; refreshing: boolean }) {
  const THRESHOLD = 60
  const progress  = Math.min(distance / THRESHOLD, 1)
  const opacity   = Math.min(progress * 2, 1)

  if (distance === 0 && !refreshing) return null

  return (
    <div
      className="absolute left-0 right-0 z-10 flex justify-center pointer-events-none"
      style={{ top: `${distance - 48}px`, opacity }}
    >
      <div className={`w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
        <svg
          className="w-5 h-5 text-brand-600"
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ transform: refreshing ? undefined : `rotate(${Math.round(progress * 360)}deg)` }}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ view }: { view: ViewTab }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <svg viewBox="0 0 120 100" className="w-36 h-28 mb-5 opacity-50" fill="none" aria-hidden="true">
        <circle cx="60" cy="50" r="42" stroke="#E5E7EB" strokeWidth="2" />
        <circle cx="60" cy="50" r="28" stroke="#E5E7EB" strokeWidth="1.5" />
        <circle cx="54" cy="44" r="14" stroke="#9CA3AF" strokeWidth="3" />
        <line x1="64" y1="54" x2="76" y2="66" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" />
        <circle cx="86" cy="22" r="2.5" fill="#D1D5DB" />
        <circle cx="32" cy="74" r="2"   fill="#D1D5DB" />
        <circle cx="90" cy="70" r="1.5" fill="#D1D5DB" />
      </svg>
      <p className="font-bold text-gray-700 text-base mb-1">
        {view === 'events' ? 'No events found' : 'No venues found'}
      </p>
      <p className="text-sm text-gray-400 max-w-xs">
        {view === 'events'
          ? 'Try adjusting your filters or search term, or check back later for new events.'
          : 'No venues match your current search. Try a different city or clear your filters.'}
      </p>
    </div>
  )
}

// ─── Virtualised events grid ──────────────────────────────────────────────────
// Groups events into rows of 2 for useVirtualizer, avoiding DOM nodes for
// off-screen rows.

const COLUMNS     = 2
const ROW_HEIGHT  = 240  // px estimate per card row (image ~90 + content ~120 + gap)

function VirtualEventsGrid({
  events,
  scrollRef,
}: {
  events:    EventCardData[]
  scrollRef: React.RefObject<HTMLDivElement>
}) {
  const rowCount = Math.ceil(events.length / COLUMNS)

  const virtualizer = useVirtualizer({
    count:            rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize:     () => ROW_HEIGHT,
    overscan:         3,
  })

  return (
    <div
      className="px-4 pb-6 pt-0"
      style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const startIdx = virtualRow.index * COLUMNS
        const items    = events.slice(startIdx, startIdx + COLUMNS)

        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position:  'absolute',
              top:        0,
              left:       0,
              width:      '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div className="grid grid-cols-2 gap-3 py-1.5">
              {items.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
              {/* Padding cell when last row has only 1 item */}
              {items.length < COLUMNS && <div />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const { city, citySlug } = useCity()
  const { showToast }      = useToast()

  useTitle(
    city ? `Discover in ${city.name}` : 'Discover',
    city
      ? `Find art events, exhibitions and performances happening in ${city.name}.`
      : 'Find art events and exhibitions near you.',
  )

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search,           setSearch]           = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [dateFilter,       setDateFilter]       = useState<DateFilter>('all')
  const [view,             setView]             = useState<ViewTab>('events')

  const debouncedSearch = useDebounce(search, 300)

  // ── Data state ────────────────────────────────────────────────────────────
  const [events,        setEvents]        = useState<EventCardData[]>([])
  const [venues,        setVenues]        = useState<VenueCardData[]>([])
  const [categories,    setCategories]    = useState<CategoryData[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [venuesLoading, setVenuesLoading] = useState(false)
  const [venuesFetched, setVenuesFetched] = useState(false)

  // ── Pull-to-refresh state ─────────────────────────────────────────────────
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing,   setRefreshing]   = useState(false)
  const touchStartY    = useRef(0)
  const isPulling      = useRef(false)
  const PULL_THRESHOLD = 60

  // ── Scroll container ref ──────────────────────────────────────────────────
  const listRef     = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef(0)

  // ── Fetch categories once ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then((r) => r.json())
      .then((data: CategoryData[]) => setCategories(data))
      .catch(() => showToast('Failed to load categories', 'error'))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch / cache events ──────────────────────────────────────────────────
  const fetchEvents = useCallback(
    async (bustCache = false) => {
      if (!citySlug) return
      const cacheKey = buildEventsCacheKey(citySlug, selectedCategory, dateFilter)

      if (!bustCache) {
        const cached = eventsCache.get(cacheKey)
        if (cached) { setEvents(cached); setEventsLoading(false); return }
      } else {
        eventsCache.invalidate(cacheKey)
      }

      setEventsLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedCategory) params.set('category', selectedCategory)
        const { dateFrom, dateTo } = getDateRange(dateFilter)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo)   params.set('dateTo',   dateTo)

        const data: EventCardData[] = await fetch(
          `${API}/api/cities/${citySlug}/events?${params}`,
        ).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })

        eventsCache.set(cacheKey, data)
        setEvents(data)
        listRef.current?.scrollTo({ top: 0 })
      } catch {
        showToast('Failed to load events. Check your connection.', 'error')
      } finally {
        setEventsLoading(false)
      }
    },
    [citySlug, selectedCategory, dateFilter, showToast],
  )

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // ── Lazy-fetch venues ─────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'venues' || venuesFetched || !citySlug) return
    setVenuesLoading(true)

    const cached = venuesCache.get(citySlug)
    if (cached) { setVenues(cached); setVenuesFetched(true); setVenuesLoading(false); return }

    fetch(`${API}/api/cities/${citySlug}/venues`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: VenueCardData[]) => {
        venuesCache.set(citySlug, data)
        setVenues(data)
        setVenuesFetched(true)
      })
      .catch(() => showToast('Failed to load venues. Check your connection.', 'error'))
      .finally(() => setVenuesLoading(false))
  }, [view, venuesFetched, citySlug, showToast])

  useEffect(() => { setVenuesFetched(false) }, [citySlug])

  // ── Pull-to-refresh handlers ──────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((listRef.current?.scrollTop ?? 1) > 0) return
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
      await fetchEvents(true)
      if (view === 'venues') { venuesCache.invalidatePrefix(citySlug ?? ''); setVenuesFetched(false) }
      setRefreshing(false)
    }
    setPullDistance(0)
  }, [pullDistance, fetchEvents, view, citySlug])

  // ── Scroll direction → hide/show bottom nav ────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const y = el.scrollTop
    const THRESHOLD = 8

    if (y > lastScrollY.current + THRESHOLD) {
      window.dispatchEvent(new CustomEvent('nav:hide'))
    } else if (y < lastScrollY.current - THRESHOLD) {
      window.dispatchEvent(new CustomEvent('nav:show'))
    }
    lastScrollY.current = y
  }, [])

  // Show nav again when leaving page
  useEffect(() => {
    return () => { window.dispatchEvent(new CustomEvent('nav:show')) }
  }, [])

  // ── Client-side search filter ─────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!debouncedSearch.trim()) return events
    const q = debouncedSearch.toLowerCase()
    return events.filter((e) => e.title.toLowerCase().includes(q))
  }, [events, debouncedSearch])

  const filteredVenues = useMemo(() => {
    if (!debouncedSearch.trim()) return venues
    const q = debouncedSearch.toLowerCase()
    return venues.filter((v) =>
      v.name.toLowerCase().includes(q) || v.address.toLowerCase().includes(q),
    )
  }, [venues, debouncedSearch])

  const resultCount = view === 'events' ? filteredEvents.length : filteredVenues.length
  const isLoading   = view === 'events' ? eventsLoading : venuesLoading

  const handleTabChange = (tab: ViewTab) => {
    setView(tab)
    listRef.current?.scrollTo({ top: 0 })
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] bg-gray-50">

      {/* ── STICKY HEADER ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">

        {/* Top row: title + city + search */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 shrink-0">Discover</h1>
          <CitySelector variant="row" />

          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events…"
              aria-label="Search events"
              className="w-full pl-9 pr-9 py-2 text-sm bg-gray-100 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div role="group" aria-label="Filter by category" className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            aria-pressed={selectedCategory === null}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors min-h-[36px] ${
              selectedCategory === null
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-transparent text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            All
          </button>
          {categories.map((cat) => {
            const active = selectedCategory === cat.slug
            return (
              <button
                key={cat.slug}
                onClick={() => setSelectedCategory(active ? null : cat.slug)}
                aria-pressed={active}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all active:scale-95 min-h-[36px]"
                style={{
                  backgroundColor: active ? cat.color : 'transparent',
                  borderColor:     cat.color,
                  color:           active ? '#fff' : cat.color,
                }}
              >
                {cat.name}
              </button>
            )
          })}
        </div>

        {/* Date filter */}
        <div role="group" aria-label="Filter by date" className="flex gap-1 px-4 pb-3">
          {DATE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateFilter(key)}
              aria-pressed={dateFilter === key}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
                dateFilter === key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab toggle + result count */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div role="tablist" aria-label="View mode" className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(['events', 'venues'] as ViewTab[]).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={view === tab}
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all min-h-[36px] ${
                  view === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 font-medium" aria-live="polite">
            {isLoading ? (
              <span className="animate-pulse">Loading…</span>
            ) : (
              <>
                <span className="text-gray-700 font-bold">{resultCount}</span>{' '}
                {view === 'events' ? 'event' : 'venue'}{resultCount !== 1 ? 's' : ''}
                {city ? ` in ${city.name}` : ''}
              </>
            )}
          </p>
        </div>
      </div>

      {/* ── SCROLLABLE LIST ─────────────────────────────────────────── */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto relative"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <PullIndicator distance={pullDistance} refreshing={refreshing} />

        {/* Loading skeletons */}
        {isLoading && (
          view === 'events' ? <SkeletonGrid count={6} /> : <SkeletonList count={4} />
        )}

        {/* Events — virtualised 2-column grid */}
        {!isLoading && view === 'events' && (
          filteredEvents.length === 0
            ? <EmptyState view="events" />
            : <VirtualEventsGrid events={filteredEvents} scrollRef={listRef} />
        )}

        {/* Venues — standard list (rarely has 100+ items) */}
        {!isLoading && view === 'venues' && (
          filteredVenues.length === 0
            ? <EmptyState view="venues" />
            : (
              <div className="flex flex-col gap-3 p-4 pb-6">
                {filteredVenues.map((venue) => (
                  <VenueCard key={venue.id} venue={venue} />
                ))}
              </div>
            )
        )}
      </div>
    </div>
  )
}
