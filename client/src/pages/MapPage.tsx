import 'leaflet/dist/leaflet.css'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import { useCity } from '../context/CityContext'
import { useToast } from '../context/ToastContext'
import CitySelector from '../components/CitySelector'
import { useTitle } from '../hooks/useTitle'
import { API_BASE } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryData { id: string; name: string; slug: string; color: string }

interface EventData {
  id:        string
  title:     string
  startDate: string
  endDate?:  string | null
  price:     number | null
  imageUrl?: string | null
  category:  { name: string; color: string; slug: string }
  venue:     { name: string; lat: number; lng: number; type: string }
}

interface VenueGroup {
  key:        string
  venueName:  string
  lat:        number
  lng:        number
  nextEvent:  EventData
  eventCount: number
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API = API_BASE
const DRAG_DISMISS_THRESHOLD = 100 // px

// ─── Leaflet icon factories ───────────────────────────────────────────────────

function venueIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;background:${color};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;"></div>`,
    iconSize:   [28, 28],
    iconAnchor: [14, 14],
  })
}

const userLocationIcon = L.divIcon({
  className: '',
  html: '<div class="user-location-dot"></div>',
  iconSize:   [18, 18],
  iconAnchor: [9, 9],
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Sub-components (inside MapContainer) ─────────────────────────────────────

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => { map.setView(center, zoom, { animate: true, duration: 0.6 }) }, [center, zoom, map])
  return null
}

function MapTapHandler({ onTap }: { onTap: () => void }) {
  useMapEvents({ click: onTap })
  return null
}

// ─── Main component ───────────────────────────────────────────────────────────

const MapPage = () => {
  const navigate   = useNavigate()
  const { citySlug, city } = useCity()
  const { showToast }      = useToast()

  useTitle(
    city ? `Map — ${city.name}` : 'Map',
    'Explore art events on an interactive map.',
  )

  // ── Local map view state ───────────────────────────────────────────────
  const [mapCenter, setMapCenter] = useState<[number, number]>([45.4654, 9.1859])
  const [mapZoom,   setMapZoom]   = useState(13)

  // ── Data ──────────────────────────────────────────────────────────────
  const [events,     setEvents]     = useState<EventData[]>([])
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [loading,    setLoading]    = useState(true)

  // ── Filters ───────────────────────────────────────────────────────────
  const [filterOpen,         setFilterOpen]         = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [freeOnly,           setFreeOnly]           = useState(false)

  // ── UI state ──────────────────────────────────────────────────────────
  const [selectedGroup, setSelectedGroup] = useState<VenueGroup | null>(null)
  const [userLocation,  setUserLocation]  = useState<[number, number] | null>(null)

  // ── Draggable bottom sheet ────────────────────────────────────────────
  const [sheetDragY,    setSheetDragY]    = useState(0)
  const sheetDragStart  = useRef(0)
  const isDraggingSheet = useRef(false)

  // ── Sync map to city ──────────────────────────────────────────────────
  useEffect(() => {
    if (city) { setMapCenter([city.lat, city.lng]); setMapZoom(city.zoomLevel) }
  }, [city])

  // ── Fetch events + categories ─────────────────────────────────────────
  useEffect(() => {
    if (!citySlug) return
    setLoading(true)
    setEvents([])
    setSelectedCategories([])
    setFreeOnly(false)
    setSelectedGroup(null)

    Promise.all([
      fetch(`${API}/api/cities/${citySlug}/events`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
      fetch(`${API}/api/categories`).then((r) => r.json()),
    ])
      .then(([evts, cats]: [EventData[], CategoryData[]]) => {
        setEvents(evts)
        setCategories(cats)
      })
      .catch(() => showToast('Failed to load map data. Check your connection.', 'error'))
      .finally(() => setLoading(false))
  }, [citySlug, showToast])

  // ── Derived venue groups ──────────────────────────────────────────────
  const venueGroups = useMemo<VenueGroup[]>(() => {
    const filtered = events.filter((e) => {
      if (freeOnly && e.price !== null) return false
      if (selectedCategories.length > 0 && !selectedCategories.includes(e.category.slug)) return false
      return true
    })
    const map = new Map<string, { events: EventData[]; venue: EventData['venue'] }>()
    filtered.forEach((event) => {
      const key = `${event.venue.name}|${event.venue.lat}|${event.venue.lng}`
      if (!map.has(key)) map.set(key, { events: [event], venue: event.venue })
      else               map.get(key)!.events.push(event)
    })
    return Array.from(map.entries()).map(([key, { events: evts, venue }]) => {
      const sorted = [...evts].sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
      return { key, venueName: venue.name, lat: venue.lat, lng: venue.lng, nextEvent: sorted[0], eventCount: evts.length }
    })
  }, [events, selectedCategories, freeOnly])

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleLocateMe = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(coords); setMapCenter(coords); setMapZoom(16)
      },
      () => showToast('Could not get your location', 'error'),
      { enableHighAccuracy: true },
    )
  }, [showToast])

  const toggleCategory = useCallback((slug: string) => {
    setSelectedCategories((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug])
  }, [])

  const handlePinClick = useCallback((group: VenueGroup) => {
    setSelectedGroup(group)
    setSheetDragY(0)
    setFilterOpen(false)
  }, [])

  const closeSheet = useCallback(() => {
    setSelectedGroup(null)
    setSheetDragY(0)
  }, [])

  // ── Sheet drag handlers ────────────────────────────────────────────────
  const handleSheetTouchStart = useCallback((e: React.TouchEvent) => {
    sheetDragStart.current = e.touches[0].clientY
    isDraggingSheet.current = true
  }, [])

  const handleSheetTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingSheet.current) return
    const delta = e.touches[0].clientY - sheetDragStart.current
    if (delta > 0) setSheetDragY(delta)
  }, [])

  const handleSheetTouchEnd = useCallback(() => {
    isDraggingSheet.current = false
    if (sheetDragY >= DRAG_DISMISS_THRESHOLD) {
      closeSheet()
    } else {
      setSheetDragY(0) // snap back
    }
  }, [sheetDragY, closeSheet])

  const activeFilterCount = selectedCategories.length + (freeOnly ? 1 : 0)

  // ─────────────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>

      {/* ── MAP ─────────────────────────────────────────────────────── */}
      <MapContainer
        center={mapCenter} zoom={mapZoom}
        className="w-full h-full"
        zoomControl={false} attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapController center={mapCenter} zoom={mapZoom} />
        <MapTapHandler onTap={closeSheet} />

        {venueGroups.map((group) => (
          <Marker
            key={group.key}
            position={[group.lat, group.lng]}
            icon={venueIcon(group.nextEvent.category.color)}
            eventHandlers={{ click: () => handlePinClick(group) }}
          />
        ))}
        {userLocation && <Marker position={userLocation} icon={userLocationIcon} />}
      </MapContainer>

      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <div className="absolute top-3 left-0 right-0 px-3 z-[1000] flex items-start gap-2 pointer-events-none">
        <div className="pointer-events-auto">
          <CitySelector variant="pill" />
        </div>
        <div className="flex-1" />

        {/* Filter button */}
        <button
          onClick={() => setFilterOpen((o) => !o)}
          aria-expanded={filterOpen}
          aria-label="Toggle filters"
          className={`pointer-events-auto flex items-center gap-1.5 rounded-full pl-3 pr-4 py-2 shadow-md text-sm font-semibold transition-all active:scale-95 min-h-[44px] ${
            filterOpen || activeFilterCount > 0
              ? 'bg-brand-600 text-white'
              : 'bg-white text-gray-800 hover:bg-gray-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-white text-brand-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold leading-none" aria-label={`${activeFilterCount} filters active`}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── FILTER PANEL ────────────────────────────────────────────── */}
      <div
        className={`absolute left-3 right-3 z-[1000] transition-all duration-300 ease-out ${
          filterOpen ? 'top-16 opacity-100 pointer-events-auto' : 'top-12 opacity-0 pointer-events-none'
        }`}
        role="region"
        aria-label="Filters"
        aria-hidden={!filterOpen}
      >
        <div className="bg-white rounded-2xl shadow-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Category</p>
          <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Category filters">
            {categories.map((cat) => {
              const active = selectedCategories.includes(cat.slug)
              return (
                <button
                  key={cat.slug}
                  onClick={() => toggleCategory(cat.slug)}
                  aria-pressed={active}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all active:scale-95 min-h-[36px]"
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

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-700" id="free-toggle-label">Free events only</span>
            <button
              onClick={() => setFreeOnly((f) => !f)}
              role="switch"
              aria-checked={freeOnly}
              aria-labelledby="free-toggle-label"
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${freeOnly ? 'bg-brand-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${freeOnly ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── LOCATE ME ───────────────────────────────────────────────── */}
      <button
        onClick={handleLocateMe}
        aria-label="Centre map on my location"
        className="absolute bottom-5 right-4 z-[1000] w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
      >
        <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path strokeLinecap="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          <circle cx="12" cy="12" r="7" />
        </svg>
      </button>

      {/* ── OSM attribution ─────────────────────────────────────────── */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-1 left-1 z-[1000] text-[10px] text-gray-400 bg-white/70 px-1 rounded"
      >
        © OpenStreetMap
      </a>

      {/* ── LOADING OVERLAY ─────────────────────────────────────────── */}
      {loading && (
        <div
          className="absolute inset-0 z-[500] flex items-center justify-center bg-white/50 backdrop-blur-sm"
          role="status"
          aria-label="Loading map data"
        >
          <div className="w-9 h-9 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── EMPTY STATE ─────────────────────────────────────────────── */}
      {!loading && venueGroups.length === 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none" role="status">
          <div className="bg-white rounded-2xl shadow-lg px-5 py-3 text-sm text-gray-500 whitespace-nowrap">
            No events found in this area
          </div>
        </div>
      )}

      {/* ── EVENT BOTTOM SHEET (draggable) ──────────────────────────── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-[1001] bg-white rounded-t-3xl shadow-2xl ${
          selectedGroup ? '' : 'pointer-events-none'
        }`}
        style={{
          transform:  selectedGroup
            ? `translateY(${sheetDragY}px)`
            : 'translateY(100%)',
          transition: isDraggingSheet.current
            ? 'none'
            : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
        role={selectedGroup ? 'dialog' : undefined}
        aria-modal={selectedGroup ? true : undefined}
        aria-label={selectedGroup ? `Event at ${selectedGroup.venueName}` : undefined}
      >
        {selectedGroup && (
          <>
            {/* ── Drag handle ───────────────────────────────────────── */}
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
              aria-label="Drag to dismiss"
            >
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Event image */}
            {selectedGroup.nextEvent.imageUrl ? (
              <img
                src={selectedGroup.nextEvent.imageUrl}
                alt=""
                loading="lazy"
                width="600"
                height="240"
                className="w-full h-40 object-cover mt-2"
              />
            ) : (
              <div
                className="w-full h-28 mt-2 flex items-center justify-center"
                style={{ backgroundColor: selectedGroup.nextEvent.category.color + '18' }}
                aria-hidden="true"
              >
                <span className="text-5xl select-none">🎨</span>
              </div>
            )}

            {/* Content */}
            <div className="px-5 pt-4 pb-6">
              <span
                className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-2"
                style={{
                  backgroundColor: selectedGroup.nextEvent.category.color + '20',
                  color:           selectedGroup.nextEvent.category.color,
                }}
              >
                {selectedGroup.nextEvent.category.name}
              </span>

              <h3 className="text-lg font-bold text-gray-900 leading-snug mb-2">
                {selectedGroup.nextEvent.title}
              </h3>

              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1.5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3"  y1="10" x2="21" y2="10" />
                </svg>
                {fmtDate(selectedGroup.nextEvent.startDate)}
                {selectedGroup.nextEvent.endDate && ` – ${fmtDate(selectedGroup.nextEvent.endDate)}`}
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{selectedGroup.venueName}</span>
                {selectedGroup.eventCount > 1 && (
                  <span className="shrink-0 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full text-gray-600">
                    +{selectedGroup.eventCount - 1} more
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {selectedGroup.nextEvent.price == null ? (
                    <span className="text-sm font-bold text-emerald-600">Free</span>
                  ) : (
                    <span className="text-sm font-bold text-gray-800">€{selectedGroup.nextEvent.price}</span>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/event/${selectedGroup.nextEvent.id}`)}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-colors active:scale-[0.98]"
                >
                  View details
                </button>
                <button
                  onClick={closeSheet}
                  aria-label="Close event details"
                  className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default MapPage
