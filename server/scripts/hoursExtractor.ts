import { parseClock, type HoursRange } from '../src/lib/openingHours'

/**
 * Pulls opening hours out of a venue page's schema.org markup.
 *
 * Hours are never inferred, guessed, or defaulted — only read from structured
 * data the venue itself published. A page without usable markup yields an empty
 * array, and the venue then shows no hours at all. That is deliberate: a
 * plausible-looking guess is worse than a blank, because the user acts on it.
 *
 * Two shapes appear in the wild and both are handled:
 *
 *   openingHoursSpecification: [{ dayOfWeek: [...], opens: "10:00", closes: "19:30" }]
 *   openingHours:              ["Tu-Su 10:00-19:30"]
 */

const DAY_NAMES: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

/** Two-letter forms used by the compact `openingHours` string syntax. */
const DAY_ABBR: Record<string, number> = {
  su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6,
}

/** Accepts a bare name, a schema.org URL, or an abbreviation. */
export function parseDayOfWeek(value: string): number | null {
  const cleaned = value.trim().toLowerCase().replace(/^https?:\/\/schema\.org\//, '')
  if (cleaned in DAY_NAMES) return DAY_NAMES[cleaned]
  if (cleaned in DAY_ABBR)  return DAY_ABBR[cleaned]
  return null
}

/** "Tu-Su" → [2,3,4,5,6,0]; wraps across Sunday the way the syntax allows. */
export function expandDayRange(spec: string): number[] {
  const range = /^([A-Za-z]{2})\s*-\s*([A-Za-z]{2})$/.exec(spec.trim())
  if (!range) {
    const single = parseDayOfWeek(spec)
    return single === null ? [] : [single]
  }
  const from = parseDayOfWeek(range[1])
  const to   = parseDayOfWeek(range[2])
  if (from === null || to === null) return []

  const days: number[] = []
  for (let i = 0; i < 7; i++) {
    const d = (from + i) % 7
    days.push(d)
    if (d === to) break
  }
  return days
}

/** One `openingHours` string, e.g. "Tu-Su 10:00-19:30" or "Mo 10:00-13:00". */
export function parseOpeningHoursString(line: string): HoursRange[] {
  // "closed" entries carry no times; dropping them is correct — a missing row
  // already means closed, and inventing a zero-length range would not.
  const m = /^\s*([A-Za-z,\s-]+?)\s+(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})\s*$/.exec(line)
  if (!m) return []

  const opensAt  = parseClock(m[2])
  const closesAt = parseClock(m[3])
  if (opensAt === null || closesAt === null || closesAt <= opensAt) return []

  const days = m[1]
    .split(',')
    .flatMap((part) => expandDayRange(part))

  return [...new Set(days)].map((weekday) => ({ weekday, opensAt, closesAt }))
}

/** One `OpeningHoursSpecification` object. */
export function parseHoursSpecification(spec: unknown): HoursRange[] {
  if (!spec || typeof spec !== 'object') return []
  const s = spec as Record<string, unknown>

  const opensAt  = typeof s.opens  === 'string' ? parseClock(s.opens)  : null
  const closesAt = typeof s.closes === 'string' ? parseClock(s.closes) : null
  if (opensAt === null || closesAt === null || closesAt <= opensAt) return []

  const raw = Array.isArray(s.dayOfWeek) ? s.dayOfWeek : s.dayOfWeek ? [s.dayOfWeek] : []
  const days = raw
    .filter((d): d is string => typeof d === 'string')
    .map(parseDayOfWeek)
    .filter((d): d is number => d !== null)

  return [...new Set(days)].map((weekday) => ({ weekday, opensAt, closesAt }))
}

/**
 * Walk every JSON-LD block on a page and collect whatever hours it declares.
 *
 * Nodes are searched recursively because museums routinely nest the place
 * inside an `@graph`, and the hours then sit two levels down from the root.
 */
export function extractHoursFromJsonLd(blocks: string[]): HoursRange[] {
  const found: HoursRange[] = []

  const visit = (node: unknown, depth = 0) => {
    if (depth > 6 || !node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1)
      return
    }

    const obj = node as Record<string, unknown>

    if (obj.openingHoursSpecification) {
      const specs = Array.isArray(obj.openingHoursSpecification)
        ? obj.openingHoursSpecification
        : [obj.openingHoursSpecification]
      for (const spec of specs) found.push(...parseHoursSpecification(spec))
    }

    if (obj.openingHours) {
      const lines = Array.isArray(obj.openingHours) ? obj.openingHours : [obj.openingHours]
      for (const line of lines) {
        if (typeof line === 'string') found.push(...parseOpeningHoursString(line))
      }
    }

    for (const value of Object.values(obj)) visit(value, depth + 1)
  }

  for (const block of blocks) {
    try {
      visit(JSON.parse(block))
    } catch {
      // A single malformed block must not abort the others.
    }
  }

  return dedupeRanges(found)
}

/**
 * Drop exact duplicates and merge overlaps.
 *
 * Nesting means the same specification is often reached twice, and a museum
 * that publishes both markup shapes declares its hours twice over. Storing both
 * would render "10:00–19:30" twice on the venue page.
 */
export function dedupeRanges(ranges: HoursRange[]): HoursRange[] {
  const byDay = new Map<number, HoursRange[]>()
  for (const r of ranges) {
    if (!byDay.has(r.weekday)) byDay.set(r.weekday, [])
    byDay.get(r.weekday)!.push(r)
  }

  const out: HoursRange[] = []
  for (const [weekday, day] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...day].sort((a, b) => a.opensAt - b.opensAt || a.closesAt - b.closesAt)
    for (const r of sorted) {
      const last = out[out.length - 1]
      // Touching ranges are merged too: a site splitting 10:00–13:00 and
      // 13:00–19:00 means continuous opening, not a lunch closure.
      if (last && last.weekday === weekday && r.opensAt <= last.closesAt) {
        last.closesAt = Math.max(last.closesAt, r.closesAt)
      } else {
        out.push({ weekday, opensAt: r.opensAt, closesAt: r.closesAt })
      }
    }
  }
  return out
}

/**
 * Does this page actually belong to the venue we asked about?
 *
 * A redirect to a portal or a parked domain would otherwise attach some other
 * institution's hours to this venue. Compares the venue's distinctive words
 * against the page, ignoring generic ones that match anything in Milan.
 */
export function pageMatchesVenue(venueName: string, pageText: string): boolean {
  const GENERIC = new Set([
    'museo', 'museum', 'galleria', 'gallery', 'fondazione', 'foundation',
    'palazzo', 'milano', 'milan', 'di', 'del', 'della', 'de', 'the', 'and', 'e',
    'arte', 'art', 'nazionale', 'civico', 'casa', 'villa', 'centro',
  ])

  const words = venueName
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !GENERIC.has(w))

  // Nothing distinctive to check on (e.g. "Museo del Novecento" is all generic
  // words) — fail closed rather than accept any page.
  if (!words.length) return false

  const haystack = pageText.toLowerCase()
  return words.some((w) => haystack.includes(w))
}
