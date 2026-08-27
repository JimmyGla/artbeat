import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ExhibitionCard, { ExhibitionCardData } from '../components/ExhibitionCard'
import StatusBarScrim from '../components/StatusBarScrim'
import SaveButton from '../components/SaveButton'
import { venueKindLabel } from '../lib/format'
import { API_BASE } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VenueDetail {
  id:          string
  name:        string
  description: string | null
  address:     string
  kind:        string
  imageUrl:    string | null
  exhibitions: ExhibitionCardData[]
  hours:       VenueHours
}

/**
 * Computed by the server in the venue's timezone, not here: the device clock
 * belongs to whoever is holding it, and a visitor from another timezone would
 * otherwise be told a Milan museum is open at 3am.
 */
interface VenueHours {
  state:
    | { status: 'open';    closesAt: number }
    | { status: 'closed';  opensAt: number | null; opensWeekday: number | null }
    | { status: 'unknown' }
  week:      { weekday: number; ranges: string[] }[]
  source:    string | null
  checkedAt: string | null
}

const DAY_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** 1170 → "19:30". Mirrors the server's formatClock. */
function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/**
 * Opening hours, or nothing at all.
 *
 * `unknown` renders null rather than "hours unavailable": most venues have no
 * hours on record, and a row of apology on every one of them is noise. Silence
 * already reads correctly as "we don't know".
 */
function OpeningHours({ hours }: { hours: VenueHours }) {
  const [expanded, setExpanded] = useState(false)

  // Bound to a local so the discriminated union narrows; reading
  // `hours.state.closesAt` through the property chain does not narrow.
  const state = hours.state
  if (state.status === 'unknown') return null

  const open = state.status === 'open'
  const today = new Date().getDay()

  let summary: string
  if (state.status === 'open') {
    summary = `Open until ${clock(state.closesAt)}`
  } else if (state.opensAt === null) {
    summary = 'Closed'
  } else if (state.opensWeekday === today) {
    summary = `Closed · opens ${clock(state.opensAt)}`
  } else {
    summary = `Closed · opens ${DAY_LABEL[state.opensWeekday ?? 0]} ${clock(state.opensAt)}`
  }

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex items-center gap-2 text-sm"
      >
        <span
          aria-hidden="true"
          className={`w-2 h-2 rounded-full shrink-0 ${open ? 'bg-green-500' : 'bg-gray-400'}`}
        />
        <span className={`font-semibold ${open ? 'text-green-700' : 'text-gray-600'}`}>
          {summary}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2.5 pl-4 flex flex-col gap-1">
          {hours.week.map((d) => (
            <div key={d.weekday} className="flex justify-between text-xs max-w-[16rem]">
              <span className={d.weekday === today ? 'font-semibold text-gray-900' : 'text-gray-500'}>
                {DAY_LABEL[d.weekday]}
              </span>
              {/* tabular-nums so the times line up in a column */}
              <span className={`tabular-nums ${d.ranges.length ? 'text-gray-700' : 'text-gray-400'}`}>
                {d.ranges.length ? d.ranges.join(', ') : 'Closed'}
              </span>
            </div>
          ))}
          {hours.source && (
            // Provenance shown deliberately: hours go stale, and the venue's own
            // page is the only authority worth checking against.
            <a
              href={hours.source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-600 mt-1"
            >
              Check on the venue's site
            </a>
          )}
        </div>
      )}
    </div>
  )
}

const VENUE_KIND_ICON: Record<string, string> = {
  MUSEUM: '🏛', GALLERY: '🖼', HOUSE_MUSEUM: '🏡', ARTIST_RESIDENCY: '🎨',
  CHURCH: '⛪', HISTORIC_BUILDING: '🏰', FOUNDATION: '◈', THEATER: '🎭', OTHER: '📍',
}

const VENUE_KIND_COLOR: Record<string, string> = {
  MUSEUM:            '#3B82F6',
  GALLERY:           '#8B5CF6',
  HOUSE_MUSEUM:      '#0EA5E9',
  ARTIST_RESIDENCY:  '#F59E0B',
  CHURCH:            '#78716C',
  HISTORIC_BUILDING: '#B45309',
  FOUNDATION:        '#DB2777',
  THEATER:           '#EC4899',
  OTHER:             '#6B7280',
}

const API = API_BASE

// ─── Component ────────────────────────────────────────────────────────────────

export default function VenueDetailPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const [venue, setVenue]     = useState<VenueDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`${API}/api/venues/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then((data: VenueDetail) => setVenue(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col min-h-dvh bg-gray-50 overflow-y-auto pb-[calc(var(--nav-h)+1.5rem)]">
        <div className="w-full bg-gray-100 animate-pulse" style={{ paddingTop: '56.25%' }} />
        <div className="p-4 space-y-3">
          <div className="h-5 bg-gray-100 rounded-full w-2/3 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded-full w-full animate-pulse" />
          <div className="h-4 bg-gray-100 rounded-full w-5/6 animate-pulse" />
        </div>
      </div>
    )
  }

  // ── Error / not found ───────────────────────────────────────────────────
  if (error || !venue) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100dvh-4rem)] bg-gray-50 px-8 text-center">
        <span className="text-5xl mb-4">🏛</span>
        <p className="font-bold text-gray-700 mb-1">Venue not found</p>
        <p className="text-sm text-gray-400 mb-6">This venue may have been removed or the link is incorrect.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl"
        >
          Go back
        </button>
      </div>
    )
  }

  const color = VENUE_KIND_COLOR[venue.kind] ?? '#6B7280'
  const icon  = VENUE_KIND_ICON[venue.kind]  ?? '📍'
  const label = venueKindLabel(venue.kind)

  // No date filter: the API already excludes finished runs, and filtering on
  // start date would drop the permanent collection — which is exactly the
  // thing a visitor to a museum page most wants to see.
  const onNow = venue.exhibitions

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-dvh bg-gray-50 overflow-y-auto pb-[calc(var(--nav-h)+1.5rem)]">
      <StatusBarScrim className="bg-gray-50" />

      {/* ── Hero image ───────────────────────────────────────────── */}
      <div className="relative w-full shrink-0" style={{ paddingTop: '56.25%' }}>
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] left-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* A place persists, so it gets the heart. Mirrors the back button. */}
        <div className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 z-10">
          <SaveButton
            target={{ kind: 'venue', id: venue.id }}
            size="sm"
            onUnauthenticated={() => navigate(`/login?redirect=/venue/${venue.id}`)}
          />
        </div>

        {venue.imageUrl ? (
          <img
            src={venue.imageUrl}
            alt={venue.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${color}33 0%, ${color}66 100%)` }}
          >
            <span className="text-7xl opacity-60 select-none">{icon}</span>
          </div>
        )}
      </div>

      {/* ── Info card ────────────────────────────────────────────── */}
      <div className="bg-white px-4 pt-4 pb-5 shadow-sm">
        {/* Type badge */}
        <span
          className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2"
          style={{ backgroundColor: color + '1A', color }}
        >
          {icon} {label}
        </span>

        {/* Name */}
        <h1 className="text-xl font-bold text-gray-900 leading-snug mb-2">{venue.name}</h1>

        {/* Address */}
        <div className="flex items-start gap-2 text-sm text-gray-500 mb-3">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{venue.address}</span>
        </div>

        <OpeningHours hours={venue.hours} />

        {/* Description */}
        {venue.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{venue.description}</p>
        )}
      </div>

      {/* ── What's on ─────────────────────────────────────────────── */}
      <div className="flex-1 px-4 pt-5 pb-8">
        <h2 className="text-base font-bold text-gray-900 mb-3">
          What's on
          {onNow.length > 0 && (
            <span className="ml-2 text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
              {onNow.length}
            </span>
          )}
        </h2>

        {onNow.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="text-4xl mb-3 opacity-50">📅</span>
            <p className="text-sm text-gray-400">Nothing on at this venue right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {onNow.map((event) => (
              <ExhibitionCard key={event.id} exhibition={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
