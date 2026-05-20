import 'leaflet/dist/leaflet.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import EventCard, { EventCardData } from '../components/EventCard'
import { useFavorites } from '../context/FavoritesContext'
import { useCity } from '../context/CityContext'
import { API_BASE } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventDetail {
  id:          string
  title:       string
  description: string | null
  startDate:   string
  endDate:     string | null
  price:       number | null
  imageUrl:    string | null
  ticketUrl:   string | null
  category: {
    id:    string
    name:  string
    slug:  string
    color: string
  }
  venue: {
    id:         string
    name:       string
    type:       string
    address:    string
    lat:        number
    lng:        number
    websiteUrl: string | null
  }
}

// ─── Config / constants ───────────────────────────────────────────────────────

const API = API_BASE

const VENUE_TYPE_LABEL: Record<string, string> = {
  GALLERY: 'Gallery',
  MUSEUM:  'Museum',
  THEATER: 'Theatre',
  OUTDOOR: 'Outdoor',
  OTHER:   'Space',
}

const VENUE_TYPE_ICON: Record<string, string> = {
  GALLERY: '🖼',
  MUSEUM:  '🏛',
  THEATER: '🎭',
  OUTDOOR: '🌿',
  OTHER:   '📍',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Leaflet pin icon ─────────────────────────────────────────────────────────

function makePin(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;
      background:${color};
      border:3px solid #fff;
      border-radius:50%;
      box-shadow:0 2px 8px rgba(0,0,0,.30);
    "></div>`,
    iconSize:   [28, 28],
    iconAnchor: [14, 14],
  })
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col bg-gray-50 min-h-[calc(100dvh-4rem)]">
      <div className="w-full bg-gray-200 animate-pulse" style={{ paddingTop: '56.25%' }} />

      <div className="px-4 pt-4 pb-6 space-y-4">
        <div className="h-4 w-20 bg-gray-200 rounded-full animate-pulse" />
        <div className="h-7 w-3/4 bg-gray-200 rounded-xl animate-pulse" />
        <div className="h-5 w-1/2 bg-gray-200 rounded-xl animate-pulse" />

        <div className="flex gap-3 pt-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 flex-1 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>

        <div className="flex gap-3 pt-1">
          <div className="h-12 w-12 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-12 flex-1 bg-gray-200 rounded-xl animate-pulse" />
        </div>

        <div className="space-y-2 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 bg-gray-200 rounded-full animate-pulse" style={{ width: i === 4 ? '60%' : '100%' }} />
          ))}
        </div>

        <div className="h-48 bg-gray-200 rounded-2xl animate-pulse mt-4" />
      </div>
    </div>
  )
}

// ─── 404 / error state ────────────────────────────────────────────────────────

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] px-8 text-center bg-gray-50">
      <span className="text-6xl mb-4">🎨</span>
      <h1 className="text-xl font-bold text-gray-800 mb-2">Event not found</h1>
      <p className="text-sm text-gray-400 mb-8 max-w-xs">
        This event may have been removed, or the link is no longer valid.
      </p>
      <button onClick={onBack} className="px-6 py-3 bg-gray-900 text-white font-semibold rounded-xl text-sm">
        Go back
      </button>
    </div>
  )
}

// ─── Toast notification ───────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      {message}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { id }                 = useParams<{ id: string }>()
  const navigate               = useNavigate()
  const location               = useLocation()
  const { citySlug }           = useCity()
  const { isFavorite, toggle } = useFavorites()

  const [event,       setEvent]       = useState<EventDetail | null>(null)
  const [moreEvents,  setMoreEvents]  = useState<EventCardData[]>([])
  const [loading,     setLoading]     = useState(true)
  const [notFound,    setNotFound]    = useState(false)
  const [toast,       setToast]       = useState('')
  const [toastVisible,setToastVisible]= useState(false)
  const toastTimer                    = useRef<ReturnType<typeof setTimeout>>()

  // ── Fetch event detail ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setNotFound(false)

    fetch(`${API}/api/events/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        if (!r.ok) throw new Error('Server error')
        return r.json()
      })
      .then((data: EventDetail | null) => { if (data) setEvent(data) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  // ── Fetch "more at this venue" ────────────────────────────────────────────
  useEffect(() => {
    if (!event || !citySlug) return

    fetch(`${API}/api/cities/${citySlug}/events`)
      .then((r) => r.json())
      .then((all: (EventCardData & { venue: { id?: string; name: string; type: string } })[]) => {
        const now  = new Date()
        const more = all.filter(
          (e) =>
            e.id !== event.id &&
            e.venue.name === event.venue.name &&
            new Date(e.startDate) >= now,
        )
        setMoreEvents(more)
      })
      .catch(console.error)
  }, [event, citySlug])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    setToastVisible(true)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200)
  }, [])

  const handleSave = useCallback(() => {
    if (!event) return
    const wasFavorited = isFavorite(event.id)
    const toggled = toggle(
      event.id,
      // If not logged in: redirect to /login instead of the generic toast
      () => navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`),
    )
    if (toggled) {
      showToast(wasFavorited ? 'Removed from saved' : 'Saved!')
    }
  }, [event, isFavorite, toggle, navigate, location.pathname, showToast])

  const handleShare = useCallback(async () => {
    const url   = window.location.href
    const title = event?.title ?? 'ArtBeat event'

    if (navigator.share) {
      try { await navigator.share({ title, url }) } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(url)
      showToast('Link copied!')
    }
  }, [event, showToast])

  // ── Render guard ──────────────────────────────────────────────────────────
  if (loading) return <Skeleton />
  if (notFound || !event) return <NotFound onBack={() => navigate(-1)} />

  const saved         = isFavorite(event.id)
  const isFree        = event.price === null
  const venueIcon     = VENUE_TYPE_ICON[event.venue.type]  ?? '📍'
  const venueLabel    = VENUE_TYPE_LABEL[event.venue.type] ?? event.venue.type
  const venuePin      = makePin(event.category.color)
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${event.venue.lat},${event.venue.lng}`

  return (
    <>
      <Toast message={toast} visible={toastVisible} />

      <div className="bg-white min-h-[calc(100dvh-4rem)] overflow-y-auto">

        {/* ── HERO ────────────────────────────────────────────────────── */}
        <div className="relative w-full shrink-0" style={{ paddingTop: '56.25%' }}>
          <button
            onClick={() => navigate(-1)}
            className="absolute top-3 left-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={handleShare}
            className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white"
            aria-label="Share event"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="18" cy="5"  r="3" />
              <circle cx="6"  cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>

          {event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${event.category.color}33 0%, ${event.category.color}66 100%)` }}
            >
              <span className="text-8xl opacity-50 select-none">🎨</span>
            </div>
          )}
        </div>

        {/* ── BODY ────────────────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-12 space-y-5">

          {/* Category pill + title */}
          <div>
            <span
              className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2"
              style={{ backgroundColor: event.category.color + '1A', color: event.category.color }}
            >
              {event.category.name}
            </span>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{event.title}</h1>
          </div>

          {/* Key info row */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700">
              <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8"  y1="2" x2="8"  y2="6" />
                <line x1="3"  y1="10" x2="21" y2="10" />
              </svg>
              <span className="font-medium">
                {fmtDate(event.startDate)}
                {event.endDate && event.endDate !== event.startDate
                  ? ` – ${fmtDate(event.endDate)}`
                  : ` · ${fmtTime(event.startDate)}`}
              </span>
            </div>

            <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${
              isFree ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-700'
            }`}>
              {isFree ? (
                <>
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Free entry
                </>
              ) : (
                <><span className="text-gray-400 font-normal">€</span>{event.price}</>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700">
              <span>{venueIcon}</span>
              <span className="font-medium">{venueLabel}</span>
            </div>
          </div>

          {/* Save + CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              aria-label={saved ? 'Remove from saved' : 'Save event'}
              className={`w-12 h-12 shrink-0 flex items-center justify-center rounded-xl border-2 transition-all active:scale-95 ${
                saved ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:border-red-200'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 transition-colors"
                fill={saved ? '#EF4444' : 'none'}
                stroke={saved ? '#EF4444' : '#6B7280'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>

            {event.ticketUrl ? (
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-12 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-colors active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                Get tickets
              </a>
            ) : (
              <div className="flex-1 h-12 flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold rounded-xl text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Free entry — just show up
              </div>
            )}
          </div>

          <div className="border-t border-gray-100" />

          {/* Description */}
          {event.description && (
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-2">About</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{event.description}</p>
            </div>
          )}

          <div className="border-t border-gray-100" />

          {/* Venue section */}
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">Venue</h2>

            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-lg"
                style={{ background: event.category.color + '1A' }}
              >
                {venueIcon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{event.venue.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{venueLabel} · {event.venue.address}</p>
              </div>
            </div>

            {/* Mini non-interactive map */}
            <div className="rounded-2xl overflow-hidden border border-gray-100 mb-3" style={{ height: 200 }}>
              <MapContainer
                center={[event.venue.lat, event.venue.lng]}
                zoom={15}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
                zoomControl={false}
                attributionControl={false}
                dragging={false}
                touchZoom={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                keyboard={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[event.venue.lat, event.venue.lng]} icon={venuePin} />
              </MapContainer>
            </div>

            <div className="flex gap-2">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-10 flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Get directions
              </a>

              {event.venue.websiteUrl && (
                <a
                  href={event.venue.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 h-10 flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path strokeLinecap="round" d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </svg>
                  Venue website
                </a>
              )}
            </div>
          </div>

          {/* More at this venue */}
          {moreEvents.length > 0 && (
            <>
              <div className="border-t border-gray-100" />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-900">More at {event.venue.name}</h2>
                  <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                    {moreEvents.length}
                  </span>
                </div>

                <div className="-mx-4 px-4">
                  <div
                    className="flex gap-3 overflow-x-auto pb-2"
                    style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
                  >
                    {moreEvents.map((e) => (
                      <div key={e.id} className="shrink-0 w-44" style={{ scrollSnapAlign: 'start' }}>
                        <EventCard event={e} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
