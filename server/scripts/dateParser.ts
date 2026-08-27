/**
 * ArtBeat — Date Parser
 *
 * Handles the full spectrum of date formats found across Italian art event sites:
 *   • ISO 8601 / RFC 2822           → fast path via new Date()
 *   • DD/MM/YYYY, DD-MM-YYYY        → Italian numeric format (JS reads these as MM/DD, so explicit)
 *   • "10 marzo 2025"               → day + full Italian month + year
 *   • "10 mar 2025"                 → day + abbreviated Italian month + year
 *   • "marzo 2025"                  → month-only → pinned to 1st of month
 *   • "dal 10 marzo al 15 giugno 2025"   → Italian range
 *   • "10 marzo – 15 giugno 2025"        → en-dash range
 *   • "10 – 15 marzo 2025"               → same-month range
 */

// ─── Month lookup (full + abbreviated) ───────────────────────────────────────

const ITALIAN_MONTH_INDEX: Record<string, number> = {
  gennaio: 0,   gen: 0,
  febbraio: 1,  feb: 1,
  marzo: 2,     mar: 2,
  aprile: 3,    apr: 3,
  maggio: 4,    mag: 4,
  giugno: 5,    giu: 5,
  luglio: 6,    lug: 6,
  agosto: 7,    ago: 7,
  settembre: 8, set: 8,
  ottobre: 9,   ott: 9,
  novembre: 10, nov: 10,
  dicembre: 11, dic: 11,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a Date from year/month(0-based)/day, returning undefined on invalid input.
 *
 * Uses `Date.UTC`, not `new Date(y, m, d)`.  The latter builds local midnight,
 * so on a machine in Rome "10 marzo 2026" was stored as 2026-03-09T22:00Z —
 * the calendar day shifted backwards, and for "marzo 2026" it crossed into the
 * previous month (2026-02-28).  That made stored dates depend on the scraper
 * host's timezone, which matters a great deal now that the server is destined
 * for a UTC container: the same page would parse to a different day than it
 * does on this laptop.  A calendar date has no timezone, so pin it to UTC.
 */
function makeDate(year: number, month: number, day: number): Date | undefined {
  if (
    isNaN(year) || isNaN(month) || isNaN(day) ||
    month < 0 || month > 11 ||
    day < 1   || day > 31
  ) return undefined
  const d = new Date(Date.UTC(year, month, day))
  // Reject overflow like 31 February, which Date silently rolls forward.
  if (d.getUTCMonth() !== month || d.getUTCDate() !== day) return undefined
  return isNaN(d.getTime()) ? undefined : d
}

function monthIndex(raw: string): number | undefined {
  return ITALIAN_MONTH_INDEX[raw.toLowerCase()]
}

function currentYear(): number {
  return new Date().getFullYear()
}

// ─── Single-date patterns ─────────────────────────────────────────────────────

interface SinglePattern {
  re: RegExp
  parse(m: RegExpMatchArray): Date | undefined
}

const SINGLE_PATTERNS: SinglePattern[] = [
  // DD/MM/YYYY or DD-MM-YYYY  ← JS would wrongly treat as MM/DD
  {
    re: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
    parse: ([, d, m, y]) => makeDate(+y, +m - 1, +d),
  },
  // DD/MM/YY
  {
    re: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/,
    parse: ([, d, m, y]) => makeDate(2000 + +y, +m - 1, +d),
  },
  // "10 marzo 2025"  or  "10 mar 2025"
  {
    re: /^(\d{1,2})\s+([a-zà-ù]+)\s+(\d{4})$/i,
    parse: ([, d, mon, y]) => {
      const mi = monthIndex(mon)
      return mi !== undefined ? makeDate(+y, mi, +d) : undefined
    },
  },
  // "10 marzo"  (no year → current year)
  {
    re: /^(\d{1,2})\s+([a-zà-ù]+)$/i,
    parse: ([, d, mon]) => {
      const mi = monthIndex(mon)
      return mi !== undefined ? makeDate(currentYear(), mi, +d) : undefined
    },
  },
  // "marzo 2025"  → pinned to 1st
  {
    re: /^([a-zà-ù]+)\s+(\d{4})$/i,
    parse: ([, mon, y]) => {
      const mi = monthIndex(mon)
      return mi !== undefined ? makeDate(+y, mi, 1) : undefined
    },
  },
]

// ─── Range patterns ───────────────────────────────────────────────────────────

interface RangePattern {
  re: RegExp
  parse(m: RegExpMatchArray): { start: Date; end: Date } | undefined
}

// Separator group that matches –, —, /, or "al"
const SEP = String.raw`(?:\s*[–—\/]\s*|\s+al\s+)`
const MON = String.raw`([a-zà-ù]+)` // captured month word

const RANGE_PATTERNS: RangePattern[] = [
  // "dal 10 marzo [2025] al 15 giugno 2025"
  {
    re: new RegExp(
      String.raw`dal\s+(\d{1,2})\s+${MON}\s*(?:(\d{4})\s+)?al\s+(\d{1,2})\s+${MON}\s+(\d{4})`,
      'i',
    ),
    parse: ([, d1, m1, y1, d2, m2, y2]) => {
      const endYear   = +y2
      const startYear = y1 ? +y1 : endYear
      const start = makeDate(startYear, monthIndex(m1) ?? -1, +d1)
      const end   = makeDate(endYear,   monthIndex(m2) ?? -1, +d2)
      return start && end ? { start, end } : undefined
    },
  },
  // "10 marzo – 15 giugno 2025"  (different months, same year)
  {
    re: new RegExp(
      String.raw`(\d{1,2})\s+${MON}${SEP}(\d{1,2})\s+${MON}\s+(\d{4})`,
      'i',
    ),
    parse: ([, d1, m1, d2, m2, y]) => {
      const year  = +y
      const start = makeDate(year, monthIndex(m1) ?? -1, +d1)
      const end   = makeDate(year, monthIndex(m2) ?? -1, +d2)
      return start && end ? { start, end } : undefined
    },
  },
  // "10 – 15 marzo 2025"  (same month)
  {
    re: new RegExp(
      String.raw`(\d{1,2})\s*[–—]\s*(\d{1,2})\s+${MON}\s+(\d{4})`,
      'i',
    ),
    parse: ([, d1, d2, mon, y]) => {
      const mi    = monthIndex(mon)
      const year  = +y
      const start = mi !== undefined ? makeDate(year, mi, +d1) : undefined
      const end   = mi !== undefined ? makeDate(year, mi, +d2) : undefined
      return start && end ? { start, end } : undefined
    },
  },
]

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a single date string into a Date.
 * Returns undefined (rather than Invalid Date) on failure.
 */
export function parseDate(raw: string | undefined | null): Date | undefined {
  if (!raw) return undefined
  const s = raw.trim()
  if (!s) return undefined

  // 1 — explicit patterns FIRST.
  //
  // These used to run second, behind a bare `new Date(s)` fast path — and JS
  // reads "03/02/2026" as 2 March (US MM/DD), so the Italian DD/MM branch was
  // unreachable for slash-separated dates and every such date came out with
  // day and month swapped whenever the day was 12 or lower.  The patterns are
  // anchored and cannot match an ISO string, so trying them first is safe.
  for (const { re, parse } of SINGLE_PATTERNS) {
    const m = s.match(re)
    if (m) {
      const d = parse(m)
      if (d) return d
    }
  }

  // 2 — ISO 8601 / RFC 2822 fallback (covers JSON-LD dates)
  const iso = new Date(s)
  if (!isNaN(iso.getTime())) return iso

  return undefined
}

export interface DateRange {
  start: Date
  end?: Date
}

/**
 * Parse a date string that may contain a range ("dal X al Y", "X – Y").
 * Falls back to a single date when no range is detected.
 * Returns undefined on complete failure.
 */
export function parseDateRange(raw: string | undefined | null): DateRange | undefined {
  if (!raw) return undefined
  const s = raw.trim()
  if (!s) return undefined

  for (const { re, parse } of RANGE_PATTERNS) {
    const m = s.match(re)
    if (m) {
      const range = parse(m)
      if (range) return range
    }
  }

  const start = parseDate(s)
  return start ? { start } : undefined
}