import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import EventCard, { EventCardData } from '../components/EventCard'
import { API_BASE } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VenueDetail {
  id:          string
  name:        string
  description: string | null
  address:     string
  type:        string
  imageUrl:    string | null
  events:      EventCardData[]
}

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

const VENUE_TYPE_COLOR: Record<string, string> = {
  GALLERY: '#8B5CF6',
  MUSEUM:  '#3B82F6',
  THEATER: '#EC4899',
  OUTDOOR: '#10B981',
  OTHER:   '#6B7280',
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
      <div className="flex flex-col h-[calc(100dvh-4rem)] bg-gray-50 overflow-y-auto">
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

  const color = VENUE_TYPE_COLOR[venue.type] ?? '#6B7280'
  const icon  = VENUE_TYPE_ICON[venue.type]  ?? '📍'
  const label = VENUE_TYPE_LABEL[venue.type] ?? venue.type

  const upcomingEvents = venue.events.filter(
    (e) => new Date(e.startDate) >= new Date(),
  )

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] bg-gray-50 overflow-y-auto">

      {/* ── Hero image ───────────────────────────────────────────── */}
      <div className="relative w-full shrink-0" style={{ paddingTop: '56.25%' }}>
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

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

        {/* Description */}
        {venue.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{venue.description}</p>
        )}
      </div>

      {/* ── Upcoming events ───────────────────────────────────────── */}
      <div className="flex-1 px-4 pt-5 pb-8">
        <h2 className="text-base font-bold text-gray-900 mb-3">
          Upcoming events
          {upcomingEvents.length > 0 && (
            <span className="ml-2 text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
              {upcomingEvents.length}
            </span>
          )}
        </h2>

        {upcomingEvents.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="text-4xl mb-3 opacity-50">📅</span>
            <p className="text-sm text-gray-400">No upcoming events at this venue.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
