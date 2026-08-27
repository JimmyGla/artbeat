import { useNavigate } from 'react-router-dom'
import SaveButton from './SaveButton'
import { venueKindLabel } from '../lib/format'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VenueCardData {
  id:                 string
  name:               string
  description?:       string | null
  address:            string
  kind:               string
  imageUrl?:          string | null
  upcomingEventCount: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  venue: VenueCardData
}

export default function VenueCard({ venue }: Props) {
  const navigate = useNavigate()
  const color    = VENUE_KIND_COLOR[venue.kind] ?? '#6B7280'

  return (
    <article
      onClick={() => navigate(`/venue/${venue.id}`)}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform flex gap-0"
    >
      {/* Image / placeholder (square, left side) */}
      <div className="relative w-24 shrink-0">
        {venue.imageUrl ? (
          <img
            src={venue.imageUrl}
            alt={venue.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full min-h-[96px] flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${color}22 0%, ${color}44 100%)` }}
          >
            <span className="text-3xl select-none">{VENUE_KIND_ICON[venue.kind] ?? '📍'}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-3.5 py-3 min-w-0">
        {/* Type badge */}
        <span
          className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5"
          style={{ backgroundColor: color + '1A', color }}
        >
          {VENUE_KIND_ICON[venue.kind]} {venueKindLabel(venue.kind)}
        </span>

        {/* Name — scraped venues can arrive with an empty name; render a
            placeholder rather than a card with no heading at all. */}
        <h3 className="text-sm font-bold leading-snug line-clamp-1 mb-1">
          {venue.name?.trim()
            ? <span className="text-gray-900">{venue.name}</span>
            : <span className="text-gray-400 italic font-medium">Unnamed venue</span>}
        </h3>

        {/* Address */}
        <p className="text-xs text-gray-400 line-clamp-2 mb-2">{venue.address}</p>

        {/* What's on badge */}
        {venue.upcomingEventCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {venue.upcomingEventCount} on now
          </span>
        ) : (
          <span className="text-xs text-gray-400">Nothing on right now</span>
        )}
      </div>

      {/* A venue persists, so it is hearted rather than bookmarked. */}
      <div className="flex items-center pr-2.5 shrink-0">
        <SaveButton target={{ kind: 'venue', id: venue.id }} variant="plain" size="sm" />
      </div>
    </article>
  )
}
