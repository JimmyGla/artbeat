import { useNavigate } from 'react-router-dom'
import SaveButton from './SaveButton'
import {
  admissionLabel, admissionIsUnknown, dateLabel, closingLabel, isClosingSoon,
  formatLabel, venueKindLabel, accentColor,
  type Admission, type RunKind,
} from '../lib/format'
import { distanceLabel } from '../hooks/useUserLocation'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExhibitionCardData {
  id:         string
  title:      string
  run:        RunKind
  format:     string
  startsOn:   string | null
  endsOn:     string | null
  admission:  Admission
  priceCents: number | null
  imageUrl?:  string | null
  artForms:   { name: string; slug: string; color: string }[]
  venue:      { id: string; name: string; kind: string }
}

const VENUE_KIND_ICON: Record<string, string> = {
  MUSEUM:            '🏛',
  GALLERY:           '🖼',
  HOUSE_MUSEUM:      '🏡',
  ARTIST_RESIDENCY:  '🎨',
  CHURCH:            '⛪',
  HISTORIC_BUILDING: '🏰',
  FOUNDATION:        '◈',
  THEATER:           '🎭',
  OTHER:             '📍',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  exhibition: ExhibitionCardData
  /**
   * Distance from the user in metres, when the list is sorted by proximity.
   * Optional because most lists have no reference point — an absent value
   * renders nothing rather than a zero.
   */
  distanceM?: number
}

export default function ExhibitionCard({ exhibition, distanceM }: Props) {
  const navigate = useNavigate()

  const accent  = accentColor(exhibition.artForms)
  // Medium is the more useful label; fall back to format when untagged.
  const tagName = exhibition.artForms[0]?.name ?? formatLabel(exhibition.format)
  const closing = closingLabel(exhibition.endsOn)
  const urgent  = isClosingSoon(exhibition.endsOn)
  const unknownPrice = admissionIsUnknown(exhibition.admission)

  return (
    <article
      onClick={() => navigate(`/exhibition/${exhibition.id}`)}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${exhibition.title}`}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/exhibition/${exhibition.id}`)}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform"
    >
      {/* ── Image ──────────────────────────────────────────────────── */}
      <div className="relative w-full" style={{ paddingTop: '56.25%' /* 16:9 */ }}>
        {exhibition.imageUrl ? (
          <img
            src={exhibition.imageUrl}
            alt=""                   /* decorative — title is in h3 below */
            loading="lazy"
            width="400"
            height="225"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accent}33 0%, ${accent}66 100%)` }}
            aria-hidden="true"
          >
            <span className="text-5xl select-none opacity-60">🎨</span>
          </div>
        )}

        {/* Admission — top left. "Price not listed" is muted rather than
            green, because it is an absence of information, not free entry. */}
        <span
          className={`absolute top-2.5 left-2.5 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${
            exhibition.admission === 'FREE'
              ? 'bg-emerald-500 text-white'
              : unknownPrice
                ? 'bg-white/80 text-gray-500 font-semibold'
                : 'bg-white/90 text-gray-800'
          }`}
        >
          {admissionLabel(exhibition.admission, exhibition.priceCents)}
        </span>

        {/* Heart or bookmark, chosen from the event's own nature. */}
        <div className="absolute top-1.5 right-1.5">
          <SaveButton target={{ kind: 'exhibition', id: exhibition.id, run: exhibition.run }} size="md" />
        </div>

        {/* Urgency only where it is real — the payoff of tracking end dates. */}
        {closing && urgent && (
          <span className="absolute bottom-2.5 left-2.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">
            {closing}
          </span>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="px-3.5 py-3">
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span
            className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: accent + '1A', color: accent }}
          >
            {tagName}
          </span>
          {exhibition.run === 'PERMANENT' && (
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              Permanent
            </span>
          )}
        </div>

        <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 mb-2">
          {exhibition.title}
        </h3>

        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1"
             aria-label={`${venueKindLabel(exhibition.venue.kind)}: ${exhibition.venue.name}`}>
          <span aria-hidden="true">{VENUE_KIND_ICON[exhibition.venue.kind] ?? '📍'}</span>
          <span className="truncate">{exhibition.venue.name}</span>
          {distanceM !== undefined && (
            // Never truncated: distance is the reason this card is in this
            // position, so it must survive a long venue name.
            <span className="shrink-0 font-medium text-brand-600">
              {distanceLabel(distanceM)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8"  y1="2" x2="8"  y2="6" />
            <line x1="3"  y1="10" x2="21" y2="10" />
          </svg>
          <span>{dateLabel({ run: exhibition.run, startsOn: exhibition.startsOn, endsOn: exhibition.endsOn })}</span>
        </div>
      </div>
    </article>
  )
}
