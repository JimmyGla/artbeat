import { useNavigate } from 'react-router-dom'
import { useFavorites } from '../context/FavoritesContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventCardData {
  id:        string
  title:     string
  startDate: string
  endDate?:  string | null
  price:     number | null
  imageUrl?: string | null
  category:  { name: string; color: string; slug: string }
  venue:     { name: string; type: string }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VENUE_TYPE_ICON: Record<string, string> = {
  GALLERY: '🖼',
  MUSEUM:  '🏛',
  THEATER: '🎭',
  OUTDOOR: '🌿',
  OTHER:   '📍',
}

function formatEventDate(iso: string): string {
  const d       = new Date(iso)
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' })
  const day     = d.getDate()
  const month   = d.toLocaleDateString('en-GB', { month: 'short' })
  const time    = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${weekday} ${day} ${month} · ${time}`
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  event: EventCardData
}

export default function EventCard({ event }: Props) {
  const navigate               = useNavigate()
  const { isFavorite, toggle } = useFavorites()
  const saved                  = isFavorite(event.id)

  return (
    <article
      onClick={() => navigate(`/event/${event.id}`)}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${event.title}`}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/event/${event.id}`)}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform"
    >
      {/* ── Image ──────────────────────────────────────────────────── */}
      <div className="relative w-full" style={{ paddingTop: '56.25%' /* 16:9 */ }}>
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt=""                   /* decorative — title is in h3 below */
            loading="lazy"
            width="400"
            height="225"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${event.category.color}33 0%, ${event.category.color}66 100%)`,
            }}
            aria-hidden="true"
          >
            <span className="text-5xl select-none opacity-60">🎨</span>
          </div>
        )}

        {/* Price badge — top left */}
        <span
          className={`absolute top-2.5 left-2.5 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${
            event.price == null
              ? 'bg-emerald-500 text-white'
              : 'bg-white/90 text-gray-800'
          }`}
        >
          {event.price == null ? 'Free' : `€${event.price}`}
        </span>

        {/* Favorite heart — 44×44 tap target */}
        <button
          onClick={(e) => { e.stopPropagation(); toggle(event.id) }}
          aria-label={saved ? `Remove "${event.title}" from favourites` : `Save "${event.title}" to favourites`}
          aria-pressed={saved}
          className="absolute top-1 right-1 w-11 h-11 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:scale-110 active:scale-95 transition-transform"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4.5 h-4.5 transition-colors"
            style={{ width: '1.125rem', height: '1.125rem' }}
            fill={saved ? '#EF4444' : 'none'}
            stroke={saved ? '#EF4444' : '#6B7280'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="px-3.5 py-3">
        {/* Category pill */}
        <span
          className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2"
          style={{
            backgroundColor: event.category.color + '1A',
            color:           event.category.color,
          }}
        >
          {event.category.name}
        </span>

        {/* Title */}
        <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 mb-2">
          {event.title}
        </h3>

        {/* Venue */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1" aria-label={`Venue: ${event.venue.name}`}>
          <span aria-hidden="true">{VENUE_TYPE_ICON[event.venue.type] ?? '📍'}</span>
          <span className="truncate">{event.venue.name}</span>
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <svg
            className="w-3.5 h-3.5 shrink-0"
            fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8"  y1="2" x2="8"  y2="6" />
            <line x1="3"  y1="10" x2="21" y2="10" />
          </svg>
          <span>{formatEventDate(event.startDate)}</span>
        </div>
      </div>
    </article>
  )
}
