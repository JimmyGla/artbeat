import { useNavigate } from 'react-router-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VenueCardData {
  id:                 string
  name:               string
  description?:       string | null
  address:            string
  type:               string
  imageUrl?:          string | null
  upcomingEventCount: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VENUE_TYPE_LABEL: Record<string, string> = {
  GALLERY:  'Gallery',
  MUSEUM:   'Museum',
  THEATER:  'Theatre',
  OUTDOOR:  'Outdoor',
  OTHER:    'Space',
}

const VENUE_TYPE_ICON: Record<string, string> = {
  GALLERY:  '🖼',
  MUSEUM:   '🏛',
  THEATER:  '🎭',
  OUTDOOR:  '🌿',
  OTHER:    '📍',
}

const VENUE_TYPE_COLOR: Record<string, string> = {
  GALLERY:  '#8B5CF6',
  MUSEUM:   '#3B82F6',
  THEATER:  '#EC4899',
  OUTDOOR:  '#10B981',
  OTHER:    '#6B7280',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  venue: VenueCardData
}

export default function VenueCard({ venue }: Props) {
  const navigate = useNavigate()
  const color    = VENUE_TYPE_COLOR[venue.type] ?? '#6B7280'

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
            <span className="text-3xl select-none">{VENUE_TYPE_ICON[venue.type] ?? '📍'}</span>
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
          {VENUE_TYPE_ICON[venue.type]} {VENUE_TYPE_LABEL[venue.type] ?? venue.type}
        </span>

        {/* Name */}
        <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-1 mb-1">
          {venue.name}
        </h3>

        {/* Address */}
        <p className="text-xs text-gray-400 line-clamp-2 mb-2">{venue.address}</p>

        {/* Upcoming events badge */}
        {venue.upcomingEventCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {venue.upcomingEventCount} upcoming event{venue.upcomingEventCount !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-xs text-gray-400">No upcoming events</span>
        )}
      </div>

      {/* Chevron */}
      <div className="flex items-center pr-3 shrink-0">
        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </article>
  )
}
