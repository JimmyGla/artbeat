import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import ExhibitionCard, { ExhibitionCardData } from '../components/ExhibitionCard'
import VenueCard, { VenueCardData } from '../components/VenueCard'
import CitySelector  from '../components/CitySelector'
import { SkeletonGrid, SkeletonList } from '../components/Skeleton'
import { useCity }   from '../context/CityContext'
import { useToast }  from '../context/ToastContext'
import { useDebounce } from '../hooks/useDebounce'
import { useTitle }  from '../hooks/useTitle'
import { MemCache }  from '../lib/memCache'
import { API_BASE, connectionError }  from '../lib/api'
import { useUserLocation } from '../hooks/useUserLocation'
import { track } from '../lib/telemetry'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArtFormData { id: string; name: string; slug: string; color: string }
type DateFilter = 'today' | 'week' | 'month' | 'all'
type ViewTab    = 'onNow' | 'venues'

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'today', label: 'Today'      },
  { key: 'week',  label: 'This week'  },
  { key: 'month', label: 'This month' },
  { key: 'all',   label: 'All'        },
]

const API = API_BASE

// ─── Module-level cache (survives re-renders, expires after 5 min) ────────────

const eventsCache = new MemCache<ExhibitionCardData[]>()
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
        {view === 'onNow' ? 'Nothing on right now' : 'No venues found'}
      </p>
      <p className="text-sm text-gray-400 max-w-xs">
        {view === 'onNow'
          ? 'Try adjusting your filters or search term, or check back later — listings change weekly.'
          : 'No venues match your current search. Try a different city or clear your filters.'}
      </p>
    </div>
  )
}

// ─── Virtualised exhibitions grid ──────────────────────────────────────────────────
// Groups exhibitions into rows of 2 for useVirtualizer, avoiding DOM nodes for
// off-screen rows.

const COLUMNS     = 2
const ROW_HEIGHT  = 240  // px estimate per card row (image ~90 + content ~120 + gap)

function VirtualExhibitionsGrid({
  events,
  scrollRef,
  distances,
}: {
  events:    ExhibitionCardData[]
  scrollRef: React.RefObject<HTMLDivElement>
  /** Present only in Near-me mode; keyed by exhibition id. */
  distances?: Map<string, number> | null
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
      className="px-4 pt-0 pb-[calc(var(--nav-h)+1.5rem)]"
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
                <ExhibitionCard
                  key={event.id}
                  exhibition={event}
                  distanceM={distances?.get(event.id)}
                />
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
  const [searchParams]     = useSearchParams()

  useTitle(
    city ? `Discover in ${city.name}` : 'Discover',
    city
      ? `Exhibitions, performances and talks happening in ${city.name}.`
      : 'Exhibitions and performances near you.',
  )

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search,           setSearch]           = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [dateFilter,       setDateFilter]       = useState<DateFilter>('all')
  const [view,             setView]             = useState<ViewTab>(searchParams.get('tab') === 'venues' ? 'venues' : 'onNow')

  const debouncedSearch = useDebounce(search, 300)

  // Searching is worth measuring — whether people search at all, and whether
  // they find anything. The query text itself is never recorded: it is
  // free-form user input, which is the single most likely place for personal
  // data to enter analytics. Length and result count answer the question
  // without carrying the content.
  useEffect(() => {
    const q = debouncedSearch.trim()
    if (q.length < 2) return
    track('search_performed', { length: q.length, results: filteredCount.current })
  }, [debouncedSearch])

  // ── Data state ────────────────────────────────────────────────────────────
  const [events,        setEvents]        = useState<ExhibitionCardData[]>([])
  const [venues,        setVenues]        = useState<VenueCardData[]>([])
  const [artForms,      setArtForms]      = useState<ArtFormData[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [venuesLoading, setVenuesLoading] = useState(false)
  const [venuesFetched, setVenuesFetched] = useState(false)

  // ── Pull-to-refresh state ─────────────────────────────────────────────────
  // ── Near me ───────────────────────────────────────────────────────────────
  //
  // A separate result set rather than a client-side sort of `events`: distance
  // is computed by PostGIS against the venue coordinates, and the endpoint also
  // excludes placeholder venues, which have city-centre coordinates and would
  // otherwise all rank as "200 m away".
  const { locate, status: locStatus, clear: clearLocation } = useUserLocation()
  const [nearMe,        setNearMe]        = useState(false)
  const [nearbyIds,     setNearbyIds]     = useState<Map<string, number> | null>(null)
  const [nearbyLoading, setNearbyLoading] = useState(false)

  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing,   setRefreshing]   = useState(false)
  const touchStartY    = useRef(0)
  const isPulling      = useRef(false)
  const PULL_THRESHOLD = 60

  // ── Scroll container ref ──────────────────────────────────────────────────
  const listRef = useRef<HTMLDivElement>(null)

  // ── Fetch categories once ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/art-forms`)
      .then((r) => r.json())
      .then((data: ArtFormData[]) => setArtForms(data))
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
        if (selectedCategory) params.set('artForm', selectedCategory)
        const { dateFrom, dateTo } = getDateRange(dateFilter)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo)   params.set('dateTo',   dateTo)

        const data: ExhibitionCardData[] = await fetch(
          `${API}/api/cities/${citySlug}/exhibitions?${params}`,
        ).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })

        eventsCache.set(cacheKey, data)
        setEvents(data)
        listRef.current?.scrollTo({ top: 0 })
      } catch {
        showToast(connectionError("what's on"), 'error')
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
      .catch(() => showToast(connectionError('venues'), 'error'))
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

  // ── Client-side search filter ─────────────────────────────────────────────
  const toggleNearMe = useCallback(async () => {
    if (nearMe) {
      setNearMe(false)
      setNearbyIds(null)
      clearLocation()
      return
    }

    setNearbyLoading(true)
    try {
      const at = await locate()
      if (!at) {
        // Distinguish refusal from failure: the fix differs, and "try again"
        // is useless advice for a denied permission.
        showToast(
          locStatus === 'denied'
            ? 'Location is off for ArtBeat. Enable it in Settings.'
            : 'Could not get your location.',
          'error',
        )
        return
      }

      const params = new URLSearchParams({
        lat: String(at.lat), lng: String(at.lng), radius: '5',
      })
      const rows: { id: string; distanceM: number }[] = await fetch(
        `${API}/api/cities/${citySlug}/exhibitions/nearby?${params}`,
      ).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })

      setNearbyIds(new Map(rows.map((r) => [r.id, r.distanceM])))
      setNearMe(true)
      // Result count, never the coordinates: where the user is, is not ours.
      track('near_me_used', { results: rows.length })
      listRef.current?.scrollTo({ top: 0 })
    } catch {
      showToast('Could not load what is near you.', 'error')
    } finally {
      setNearbyLoading(false)
    }
  }, [nearMe, locate, locStatus, citySlug, showToast, clearLocation])

  const filteredEvents = useMemo(() => {
    let list = events
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      list = list.filter((e) => e.title.toLowerCase().includes(q))
    }
    if (nearMe && nearbyIds) {
      // Intersect rather than replace, so the art-form and date filters still
      // apply — "near me" narrows the current view, it does not escape it.
      list = list
        .filter((e) => nearbyIds.has(e.id))
        .sort((a, b) => nearbyIds.get(a.id)! - nearbyIds.get(b.id)!)
    }
    return list
  }, [events, debouncedSearch, nearMe, nearbyIds])

  // Read by the search event above. A ref rather than state: this feeds
  // telemetry only, and making it state would re-render on every keystroke.
  const filteredCount = useRef(0)
  filteredCount.current = filteredEvents.length

  const filteredVenues = useMemo(() => {
    if (!debouncedSearch.trim()) return venues
    const q = debouncedSearch.toLowerCase()
    return venues.filter((v) =>
      v.name.toLowerCase().includes(q) || v.address.toLowerCase().includes(q),
    )
  }, [venues, debouncedSearch])

  const resultCount = view === 'onNow' ? filteredEvents.length : filteredVenues.length
  const isLoading   = view === 'onNow' ? eventsLoading : venuesLoading

  const handleTabChange = (tab: ViewTab) => {
    setView(tab)
    listRef.current?.scrollTo({ top: 0 })
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col bg-gray-50 h-dvh">

      {/* ── STICKY HEADER ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

        {/* Top row: title + city + search */}
        <div className="px-4 pt-3 pb-3 flex items-center gap-3">
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
              placeholder="Search what's on…"
              aria-label="Search what's on"
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
        <div role="group" aria-label="Filter by medium" className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
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
          {artForms.map((cat) => {
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

        {/* Near me. Only on What's on: the nearby endpoint returns exhibitions,
            and the Venues tab has no distance to sort by. */}
        {view === 'onNow' && (
          <div className="px-4 pb-2.5">
            <button
              onClick={toggleNearMe}
              aria-pressed={nearMe}
              disabled={nearbyLoading}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] disabled:opacity-60 ${
                nearMe ? 'bg-brand-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {nearbyLoading ? 'Locating…' : nearMe ? 'Near me · 5 km' : 'Near me'}
            </button>
            {nearMe && (
              <span className="ml-2 text-xs text-gray-500">closest first</span>
            )}
          </div>
        )}

        {/* Tab toggle + result count */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div role="tablist" aria-label="View mode" className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {([['onNow', "What's on"], ['venues', 'Venues']] as [ViewTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                role="tab"
                aria-selected={view === tab}
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                  view === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 font-medium" aria-live="polite">
            {isLoading ? (
              <span className="animate-pulse">Loading…</span>
            ) : (
              <>
                <span className="text-gray-700 font-bold">{resultCount}</span>{' '}
                {view === 'onNow' ? 'on now' : `venue${resultCount !== 1 ? 's' : ''}`}
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <PullIndicator distance={pullDistance} refreshing={refreshing} />

        {/* Loading skeletons */}
        {isLoading && (
          view === 'onNow' ? <SkeletonGrid count={6} /> : <SkeletonList count={4} />
        )}

        {/* What's on — virtualised 2-column grid */}
        {!isLoading && view === 'onNow' && (
          filteredEvents.length === 0
            ? <EmptyState view="onNow" />
            : <VirtualExhibitionsGrid
                events={filteredEvents}
                scrollRef={listRef}
                distances={nearMe ? nearbyIds : null}
              />
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
