import { describe, it, expect } from 'vitest'
import {
  openState, parseClock, formatClock, localParts, addDaysYmd, weeklySummary,
  type HoursRange,
} from '../lib/openingHours'

/**
 * "Open now" is the only claim in this app a user acts on with their body, and
 * the failure mode is someone travelling across Milan to a locked door. Every
 * case here is a way that could happen.
 *
 * Times are UTC instants; the assertions are about what they mean in Rome.
 * Two dates are used deliberately: January (CET, +1) and July (CEST, +2), so a
 * hardcoded offset cannot pass.
 */

const TZ = 'Europe/Rome'

/** Tue–Sun 10:00–19:30, closed Monday: the standard Italian museum week. */
const MUSEUM: HoursRange[] = [2, 3, 4, 5, 6, 0].map((weekday) => ({
  weekday, opensAt: 600, closesAt: 1170,
}))

const none = new Set<string>()

describe('parseClock / formatClock', () => {
  it('round-trips a normal time', () => {
    expect(parseClock('09:30')).toBe(570)
    expect(formatClock(570)).toBe('09:30')
  })

  it('accepts the dotted form Italian sites use', () => {
    expect(parseClock('19.30')).toBe(1170)
  })

  it('rejects malformed input instead of guessing', () => {
    // A silent 0 here would read as "opens at midnight" and mark a venue open
    // all night.
    for (const bad of ['', 'ore 10', '10', '25:00', '10:75', 'closed', '1030']) {
      expect(parseClock(bad)).toBeNull()
    }
  })

  it('pads for column alignment', () => {
    expect(formatClock(600)).toBe('10:00')
    expect(formatClock(0)).toBe('00:00')
  })
})

describe('localParts', () => {
  it('resolves Rome wall-clock in winter (CET, +1)', () => {
    const p = localParts(new Date('2026-01-14T09:00:00Z'), TZ)
    expect(p.minutes).toBe(10 * 60) // 10:00 local
    expect(p.weekday).toBe(3)       // Wednesday
    expect(p.ymd).toBe('2026-01-14')
  })

  it('resolves Rome wall-clock in summer (CEST, +2)', () => {
    // The regression a fixed offset would cause: same UTC hour, different local
    // hour, because of DST.
    const p = localParts(new Date('2026-07-15T09:00:00Z'), TZ)
    expect(p.minutes).toBe(11 * 60) // 11:00 local
    expect(p.ymd).toBe('2026-07-15')
  })

  it('rolls the local date over when UTC is still on the previous day', () => {
    // 23:30 UTC is already tomorrow in Rome — a naive UTC date would pick the
    // wrong weekday and so the wrong opening hours.
    const p = localParts(new Date('2026-07-15T23:30:00Z'), TZ)
    expect(p.ymd).toBe('2026-07-16')
    expect(p.weekday).toBe(4) // Thursday
  })
})

describe('openState', () => {
  it('is open during opening hours', () => {
    // Wed 2026-01-14, 10:00 UTC = 11:00 Rome.
    const s = openState(MUSEUM, none, TZ, new Date('2026-01-14T10:00:00Z'))
    expect(s.status).toBe('open')
    if (s.status === 'open') expect(formatClock(s.closesAt)).toBe('19:30')
  })

  it('is closed before opening, and says when it opens today', () => {
    const s = openState(MUSEUM, none, TZ, new Date('2026-01-14T07:00:00Z')) // 08:00 Rome
    expect(s.status).toBe('closed')
    if (s.status === 'closed') {
      expect(s.opensAt).toBe(600)
      expect(s.opensWeekday).toBe(3) // still Wednesday
    }
  })

  it('is closed at exactly the closing minute', () => {
    // 19:30 local, the boundary. Off-by-one here is the difference between
    // "open" and a locked door.
    const s = openState(MUSEUM, none, TZ, new Date('2026-01-14T18:30:00Z'))
    expect(s.status).toBe('closed')
  })

  it('is open at exactly the opening minute', () => {
    const s = openState(MUSEUM, none, TZ, new Date('2026-01-14T09:00:00Z')) // 10:00 Rome
    expect(s.status).toBe('open')
  })

  it('skips Monday and points at Tuesday', () => {
    // Mon 2026-01-12. The museum has no Monday row at all.
    const s = openState(MUSEUM, none, TZ, new Date('2026-01-12T10:00:00Z'))
    expect(s.status).toBe('closed')
    if (s.status === 'closed') expect(s.opensWeekday).toBe(2) // Tuesday
  })

  it('honours an exceptional closure even during normal hours', () => {
    // A public holiday falling on an open day: the weekly pattern says open,
    // the closure must win.
    const s = openState(MUSEUM, new Set(['2026-01-14']), TZ, new Date('2026-01-14T10:00:00Z'))
    expect(s.status).toBe('closed')
  })

  it('looks past a closed day to the next real opening', () => {
    const s = openState(
      MUSEUM,
      new Set(['2026-01-14', '2026-01-15']),
      TZ,
      new Date('2026-01-14T20:00:00Z'),
    )
    expect(s.status).toBe('closed')
    if (s.status === 'closed') expect(s.opensWeekday).toBe(5) // Friday
  })

  it('handles a lunch closure as two ranges on one day', () => {
    const split: HoursRange[] = [
      { weekday: 3, opensAt: 600, closesAt: 780 },   // 10:00–13:00
      { weekday: 3, opensAt: 900, closesAt: 1140 },  // 15:00–19:00
    ]
    // 14:00 Rome — inside the gap.
    const gap = openState(split, none, TZ, new Date('2026-01-14T13:00:00Z'))
    expect(gap.status).toBe('closed')
    if (gap.status === 'closed') expect(gap.opensAt).toBe(900)

    // 16:00 Rome — inside the afternoon range.
    expect(openState(split, none, TZ, new Date('2026-01-14T15:00:00Z')).status).toBe('open')
  })

  it('reports unknown when there are no hours, never closed', () => {
    // The core contract: absence of data is not evidence of closure, and
    // "closed" is the answer a user would act on.
    expect(openState([], none, TZ).status).toBe('unknown')
  })

  it('reports unknown for an invalid timezone rather than falling back to UTC', () => {
    expect(openState(MUSEUM, none, 'Not/AZone', new Date('2026-01-14T10:00:00Z')).status)
      .toBe('unknown')
  })

  it('gives no next opening when every day is excluded', () => {
    const s = openState([{ weekday: 3, opensAt: 600, closesAt: 1170 }], new Set(['2026-01-21']), TZ,
      new Date('2026-01-14T20:00:00Z'))
    expect(s.status).toBe('closed')
    if (s.status === 'closed') expect(s.opensAt).toBeNull()
  })

  it('uses summer offset in summer', () => {
    // 08:30 UTC = 10:30 CEST, open. Under CET (+1) it would be 09:30, closed —
    // so this fails if DST is ignored.
    expect(openState(MUSEUM, none, TZ, new Date('2026-07-15T08:30:00Z')).status).toBe('open')
  })
})

describe('addDaysYmd', () => {
  it('crosses month and year boundaries', () => {
    expect(addDaysYmd('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles a leap day', () => {
    expect(addDaysYmd('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('weeklySummary', () => {
  it('lists all seven days so a closed day is explicit', () => {
    const rows = weeklySummary(MUSEUM)
    expect(rows).toHaveLength(7)
    expect(rows[1].ranges).toEqual([])                  // Monday: closed
    expect(rows[3].ranges).toEqual(['10:00–19:30'])
  })

  it('keeps split ranges in chronological order', () => {
    const rows = weeklySummary([
      { weekday: 3, opensAt: 900, closesAt: 1140 },
      { weekday: 3, opensAt: 600, closesAt: 780 },
    ])
    expect(rows[3].ranges).toEqual(['10:00–13:00', '15:00–19:00'])
  })
})
