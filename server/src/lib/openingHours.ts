/**
 * "Open now", computed in the venue's own timezone.
 *
 * This is the one field in the app a user acts on with their body: a wrong
 * answer sends someone across Milan to a locked door. So the rules here fail
 * towards silence — an unknown answer is returned as `unknown`, never as
 * "open", and never as "closed" either, since both of those are claims.
 *
 * Everything is evaluated in the city's IANA zone rather than the server's.
 * A container running UTC is an hour or two behind Rome depending on DST, which
 * is exactly enough to report a museum open after it has shut.
 */

export interface HoursRange {
  /** 0 = Sunday … 6 = Saturday, matching JS `Date.getDay()`. */
  weekday: number
  /** Minutes from local midnight. */
  opensAt: number
  closesAt: number
}

export type OpenState =
  | { status: 'open';    closesAt: number; note?: string }
  | { status: 'closed';  opensAt: number | null; opensWeekday: number | null; note?: string }
  | { status: 'unknown' }

/** "09:30" → 570. Returns null for anything malformed rather than guessing. */
export function parseClock(value: string): number | null {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(value)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 24 || min > 59) return null
  const total = h * 60 + min
  return total <= 1440 ? total : null
}

/** 570 → "09:30". Zero-padded so times line up in a column. */
export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * The wall-clock weekday and minute-of-day at `instant` in `timeZone`.
 *
 * Uses `Intl` parts rather than arithmetic on UTC offsets: Italy switches to
 * summer time, so any fixed +1/+2 assumption is wrong for part of the year.
 * An invalid zone throws inside Intl, which is caught by the caller and
 * surfaced as `unknown` — a bad zone must not silently become UTC.
 */
export function localParts(
  instant: Date,
  timeZone: string,
): { weekday: number; minutes: number; ymd: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts: Record<string, string> = {}
  for (const p of fmt.formatToParts(instant)) parts[p.type] = p.value

  const WEEKDAYS: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }

  // Intl renders midnight as hour "24" in some locales/zones; normalise so it
  // lands at the start of the day rather than past its end.
  const hour = Number(parts.hour) % 24

  return {
    weekday: WEEKDAYS[parts.weekday] ?? 0,
    minutes: hour * 60 + Number(parts.minute),
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  }
}

/**
 * Whether the venue is open at `now`.
 *
 * `closureDates` are the venue's exceptional closures as `YYYY-MM-DD` strings
 * in the city's timezone; a match closes the venue for that whole day and
 * overrides the weekly pattern, which is how public holidays actually behave.
 */
export function openState(
  ranges: HoursRange[],
  closureDates: Set<string>,
  timeZone: string,
  now: Date = new Date(),
): OpenState {
  // No hours on record is genuinely unknown. Reporting "closed" here would be
  // a claim we cannot support, and it is the answer users would act on most.
  if (!ranges.length) return { status: 'unknown' }

  let local
  try {
    local = localParts(now, timeZone)
  } catch {
    return { status: 'unknown' }
  }

  const closedToday = closureDates.has(local.ymd)

  if (!closedToday) {
    const open = ranges.find(
      (r) => r.weekday === local.weekday && local.minutes >= r.opensAt && local.minutes < r.closesAt,
    )
    if (open) return { status: 'open', closesAt: open.closesAt }

    // Still to come today.
    const later = ranges
      .filter((r) => r.weekday === local.weekday && r.opensAt > local.minutes)
      .sort((a, b) => a.opensAt - b.opensAt)[0]
    if (later) return { status: 'closed', opensAt: later.opensAt, opensWeekday: local.weekday }
  }

  // Search forward for the next day that has hours and is not a closure. Seven
  // days covers a full cycle; a venue closed every day of the week has no next
  // opening, which is reported honestly as null rather than as day 8.
  for (let ahead = 1; ahead <= 7; ahead++) {
    const weekday = (local.weekday + ahead) % 7
    const ymd = addDaysYmd(local.ymd, ahead)
    if (closureDates.has(ymd)) continue

    const first = ranges
      .filter((r) => r.weekday === weekday)
      .sort((a, b) => a.opensAt - b.opensAt)[0]
    if (first) return { status: 'closed', opensAt: first.opensAt, opensWeekday: weekday }
  }

  return { status: 'closed', opensAt: null, opensWeekday: null }
}

/**
 * Add whole days to a `YYYY-MM-DD` string.
 *
 * Done in UTC on a date-only value so it stays pure calendar arithmetic: using
 * the local timezone here would make the result depend on the server's clock,
 * reintroducing the bug this module exists to avoid.
 */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/**
 * Collapse ranges into one line per weekday for display.
 *
 * Returns all seven days so "Monday: closed" is explicit — Italian museums
 * usually close on Monday, and an omitted row reads as missing data rather
 * than as a closure.
 */
export function weeklySummary(ranges: HoursRange[]): { weekday: number; ranges: string[] }[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    ranges: ranges
      .filter((r) => r.weekday === weekday)
      .sort((a, b) => a.opensAt - b.opensAt)
      .map((r) => `${formatClock(r.opensAt)}–${formatClock(r.closesAt)}`),
  }))
}
