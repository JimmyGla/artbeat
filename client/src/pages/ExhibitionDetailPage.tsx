import 'leaflet/dist/leaflet.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import ExhibitionCard, { ExhibitionCardData } from '../components/ExhibitionCard'
import StatusBarScrim from '../components/StatusBarScrim'
import SaveButton from '../components/SaveButton'
import {
  admissionLabel, dateLabel, closingLabel,
  venueKindLabel, accentColor, formatLabel,
  type Admission, type RunKind,
} from '../lib/format'
import { useCity } from '../context/CityContext'
import { API_BASE, shareTarget } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExhibitionDetail {
  id:          string
  title:       string
  description: string | null
  run:         RunKind
  format:      string
  startsOn:    string | null
  endsOn:      string | null
  admission:   Admission
  priceCents:  number | null
  imageUrl:    string | null
  ticketUrl:   string | null
  artForms:    { name: string; slug: string; color: string }[]
  venue: {
    id:         string
    name:       string
    kind:       string
    address:    string
    lat:        number
    lng:        number
    websiteUrl: string | null
  }
}

// ─── Config / constants ───────────────────────────────────────────────────────

const API = API_BASE

const VENUE_KIND_ICON: Record<string, string> = {
  MUSEUM: '🏛', GALLERY: '🖼', HOUSE_MUSEUM: '🏡', ARTIST_RESIDENCY: '🎨',
  CHURCH: '⛪', HISTORIC_BUILDING: '🏰', FOUNDATION: '◈', THEATER: '🎭', OTHER: '📍',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
      <h1 className="text-xl font-bold text-gray-800 mb-2">Exhibition not found</h1>
      <p className="text-sm text-gray-400 mb-8 max-w-xs">
        This exhibition may have been removed, or the link is no longer valid.
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

export default function ExhibitionDetailPage() {
  const { id }                 = useParams<{ id: string }>()
  const navigate               = useNavigate()
  const location               = useLocation()
  const { citySlug }           = useCity()

  const [exhibition,       setExhibition]       = useState<ExhibitionDetail | null>(null)
  const [moreExhibitions,  setMoreExhibitions]  = useState<ExhibitionCardData[]>([])
  const [loading,     setLoading]     = useState(true)
  const [notFound,    setNotFound]    = useState(false)
  const [toast,       setToast]       = useState('')
  const [toastVisible,setToastVisible]= useState(false)
  const toastTimer                    = useRef<ReturnType<typeof setTimeout>>()

  // ── Fetch exhibition detail ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setNotFound(false)

    fetch(`${API}/api/exhibitions/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        if (!r.ok) throw new Error('Server error')
        return r.json()
      })
      .then((data: ExhibitionDetail | null) => { if (data) setExhibition(data) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  // ── Fetch "more at this venue" ────────────────────────────────────────────
  useEffect(() => {
    if (!exhibition || !citySlug) return

    fetch(`${API}/api/cities/${citySlug}/exhibitions`)
      .then((r) => r.json())
      .then((all: ExhibitionCardData[]) => {
        // The API already excludes finished runs, so no date filtering here —
        // it would also wrongly drop permanent collections, which have no
        // start date to compare.
        const more = all.filter(
          (e) => e.id !== exhibition.id && e.venue.name === exhibition.venue.name,
        )
        setMoreExhibitions(more)
      })
      .catch(console.error)
  }, [exhibition, citySlug])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    setToastVisible(true)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200)
  }, [])

  // SaveButton performs the toggle; this only reports it. Wording follows the
  // verb, because "Saved" would blur the two meanings back together.
  const handleSaveToast = useCallback((nowSaved: boolean, verb: 'heart' | 'bookmark') => {
    const heart = verb === 'heart'
    showToast(nowSaved
      ? (heart ? 'Added to your places'     : 'Saved to see before it closes')
      : (heart ? 'Removed from your places' : 'Removed from your list'))
  }, [showToast])

  const handleShare = useCallback(async () => {
    if (!exhibition) return
    const title = exhibition.title

    // Never share window.location.href: in the WebView that is
    // capacitor://localhost/... and useless to the recipient.
    const url = shareTarget(exhibition.id, exhibition.ticketUrl)
    if (!url) {
      showToast('Nothing to share for this one yet')
      return
    }

    if (navigator.share) {
      try { await navigator.share({ title, url }) } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(url)
      showToast('Link copied')
    }
  }, [exhibition, showToast])

  // ── Render guard ──────────────────────────────────────────────────────────
  if (loading) return <Skeleton />
  if (notFound || !exhibition) return <NotFound onBack={() => navigate(-1)} />

  const accent        = accentColor(exhibition.artForms)
  const venueIcon     = VENUE_KIND_ICON[exhibition.venue.kind]  ?? '📍'
  const venueLabel    = venueKindLabel(exhibition.venue.kind)
  const venuePin      = makePin(accent)
  const closing       = closingLabel(exhibition.endsOn)
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${exhibition.venue.lat},${exhibition.venue.lng}`

  return (
    <>
      <Toast message={toast} visible={toastVisible} />
      <StatusBarScrim className="bg-white" />

      <div className="bg-white min-h-dvh overflow-y-auto pb-[calc(var(--nav-h)+1.5rem)]">

        {/* ── HERO ────────────────────────────────────────────────────── */}
        <div className="relative w-full shrink-0" style={{ paddingTop: '56.25%' }}>
          <button
            onClick={() => navigate(-1)}
            className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] left-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={handleShare}
            className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white"
            aria-label="Share exhibition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="18" cy="5"  r="3" />
              <circle cx="6"  cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>

          {exhibition.imageUrl ? (
            <img
              src={exhibition.imageUrl}
              alt={exhibition.title}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${accent}33 0%, ${accent}66 100%)` }}
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
              style={{ backgroundColor: accent + '1A', color: accent }}
            >
              {exhibition.artForms[0]?.name ?? formatLabel(exhibition.format)}
            </span>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{exhibition.title}</h1>
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
                {dateLabel({ run: exhibition.run, startsOn: exhibition.startsOn, endsOn: exhibition.endsOn })}
                {closing && <span className="ml-2 font-semibold text-amber-600">{closing}</span>}
              </span>
            </div>

            {/* Three states, not two: an unlisted price is not free entry. */}
            <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${
              exhibition.admission === 'FREE'
                ? 'bg-emerald-50 text-emerald-700'
                : exhibition.admission === 'UNKNOWN'
                  ? 'bg-gray-50 text-gray-400 font-medium'
                  : 'bg-gray-50 text-gray-700'
            }`}>
              {exhibition.admission === 'FREE' && (
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {admissionLabel(exhibition.admission, exhibition.priceCents)}
            </div>

            <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700">
              <span>{venueIcon}</span>
              <span className="font-medium">{venueLabel}</span>
            </div>
          </div>

          {/* Save + CTA */}
          <div className="flex items-center gap-3">
            {/* Heart or bookmark, decided by the run — see SaveButton. */}
            <SaveButton
              target={{ kind: 'exhibition', id: exhibition.id, run: exhibition.run }}
              variant="plain"
              onUnauthenticated={() => navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)}
              onToggled={handleSaveToast}
            />

            {exhibition.ticketUrl ? (
              <a
                href={exhibition.ticketUrl}
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
          {exhibition.description && (
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-2">About</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{exhibition.description}</p>
            </div>
          )}

          <div className="border-t border-gray-100" />

          {/* Venue section */}
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">Venue</h2>

            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-lg"
                style={{ background: accent + '1A' }}
              >
                {venueIcon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{exhibition.venue.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{venueLabel} · {exhibition.venue.address}</p>
              </div>
            </div>

            {/* Mini non-interactive map */}
            <div className="rounded-2xl overflow-hidden border border-gray-100 mb-3" style={{ height: 200 }}>
              <MapContainer
                center={[exhibition.venue.lat, exhibition.venue.lng]}
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
                <Marker position={[exhibition.venue.lat, exhibition.venue.lng]} icon={venuePin} />
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

              {exhibition.venue.websiteUrl && (
                <a
                  href={exhibition.venue.websiteUrl}
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
          {moreExhibitions.length > 0 && (
            <>
              <div className="border-t border-gray-100" />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-900">More at {exhibition.venue.name}</h2>
                  <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                    {moreExhibitions.length}
                  </span>
                </div>

                <div className="-mx-4 px-4">
                  <div
                    className="flex gap-3 overflow-x-auto pb-2"
                    style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
                  >
                    {moreExhibitions.map((e) => (
                      <div key={e.id} className="shrink-0 w-44" style={{ scrollSnapAlign: 'start' }}>
                        <ExhibitionCard exhibition={e} />
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
