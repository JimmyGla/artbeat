/**
 * Display helpers for the new event shape.
 *
 * Kept together because admission and dates are exactly the places where the
 * old model lied: `price = null` meant both free and unknown, and a missing
 * end date meant both "permanent" and "we could not read it". These functions
 * are the only place that vocabulary gets turned into words.
 */

export type Admission = 'FREE' | 'PAID' | 'UNKNOWN'
export type RunKind   = 'PERMANENT' | 'TEMPORARY'

export interface EventDates {
  run:      RunKind
  startsOn: string | null
  endsOn:   string | null
}

/**
 * What to show where a price goes.
 *
 * `UNKNOWN` deliberately does not say "Free" — that was the bug. It says the
 * price is not listed, which is true and lets the user decide to check.
 */
export function admissionLabel(admission: Admission, priceCents: number | null): string {
  if (admission === 'FREE') return 'Free'
  if (admission === 'PAID' && priceCents != null) {
    const euros = priceCents / 100
    // Whole euros are the common case; only show cents when they exist.
    return `€${Number.isInteger(euros) ? euros : euros.toFixed(2)}`
  }
  if (admission === 'PAID') return 'Ticketed'
  return 'Price not listed'
}

/** True when the admission line is a statement of ignorance, not a price. */
export function admissionIsUnknown(admission: Admission): boolean {
  return admission === 'UNKNOWN'
}

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const fmtDayShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/**
 * The date line for an event.
 *
 * Dates are stored as calendar days, so they are formatted in UTC — reading
 * them in local time is what shifted them by a day.
 */
export function dateLabel({ run, startsOn, endsOn }: EventDates): string {
  if (run === 'PERMANENT') return 'Permanent collection'
  if (!startsOn) return ''
  if (!endsOn) return fmtDay(startsOn)

  const sameYear = new Date(startsOn).getUTCFullYear() === new Date(endsOn).getUTCFullYear()
  return `${sameYear ? fmtDayShort(startsOn) : fmtDay(startsOn)} – ${fmtDay(endsOn)}`
}

/** Whole days from today until closing. Negative once it has ended. */
export function daysUntilClose(endsOn: string | null, now: Date = new Date()): number | null {
  if (!endsOn) return null
  const end   = Date.UTC(new Date(endsOn).getUTCFullYear(), new Date(endsOn).getUTCMonth(), new Date(endsOn).getUTCDate())
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((end - today) / 86_400_000)
}

/**
 * Urgency copy for the "To see" list — the reason a bookmark is worth having.
 * Returns null when there is nothing pressing to say.
 */
export function closingLabel(endsOn: string | null, now: Date = new Date()): string | null {
  const days = daysUntilClose(endsOn, now)
  if (days === null) return null
  if (days < 0)  return 'Closed'
  if (days === 0) return 'Last day'
  if (days === 1) return 'Closes tomorrow'
  if (days <= 30) return `Closes in ${days} days`
  return null
}

/** Closing soon enough to warrant visual emphasis. */
export function isClosingSoon(endsOn: string | null, now: Date = new Date()): boolean {
  const days = daysUntilClose(endsOn, now)
  return days !== null && days >= 0 && days <= 14
}

const VENUE_KIND_LABEL: Record<string, string> = {
  MUSEUM:            'Museum',
  GALLERY:           'Gallery',
  HOUSE_MUSEUM:      'House museum',
  ARTIST_RESIDENCY:  'Artist residency',
  CHURCH:            'Church',
  HISTORIC_BUILDING: 'Historic building',
  FOUNDATION:        'Foundation',
  THEATER:           'Theatre',
  OTHER:             'Venue',
}

export function venueKindLabel(kind: string): string {
  return VENUE_KIND_LABEL[kind] ?? 'Venue'
}

const FORMAT_LABEL: Record<string, string> = {
  EXHIBITION:  'Exhibition',
  OPENING:     'Opening',
  PERFORMANCE: 'Performance',
  WORKSHOP:    'Workshop',
  TALK:        'Talk',
  SCREENING:   'Screening',
}

export function formatLabel(format: string): string {
  return FORMAT_LABEL[format] ?? 'Event'
}

/**
 * Colour for a card or pin. Art form beats format: "what medium is this" is
 * more useful to a visitor than "is this an opening", and it is why ArtForm
 * carries a colour at all.
 */
export function accentColor(
  artForms: { color: string }[],
  fallback = '#7C3AED',
): string {
  return artForms[0]?.color ?? fallback
}
