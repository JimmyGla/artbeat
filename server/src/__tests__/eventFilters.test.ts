import { describe, it, expect } from 'vitest'
import { stillOn, hasClosed } from '../lib/eventFilters'

/**
 * `stillOn` decides what the whole app shows.  Getting it wrong is not
 * hypothetical: the original filter used `startDate >= now`, which excluded
 * every currently-open exhibition and made all 15 venues report zero events.
 *
 * It returns a Prisma `where` fragment, so these tests assert its shape rather
 * than running queries — no database required, which keeps them fit for CI.
 */

describe('stillOn', () => {
  const now = new Date('2026-08-21T00:00:00.000Z')
  const branches = (d = now) => (stillOn(d) as { OR: any[] }).OR

  it('offers three alternatives: permanent, running, or not yet started', () => {
    expect(branches()).toHaveLength(3)
  })

  it('excludes exhibitions confirmed taken down', () => {
    // A withdrawn row is kept for history but must never appear in a listing,
    // and this sits outside the OR so it applies to permanent runs too.
    expect(stillOn(now)).toMatchObject({ withdrawnAt: null })
  })

  it('includes permanent runs unconditionally', () => {
    // The branch whose absence was the original bug: a permanent collection
    // has no dates to compare, so any date-based filter excluded it.
    expect(branches()).toContainEqual({ run: 'PERMANENT' })
  })

  it('keeps runs whose end date has not passed', () => {
    expect(branches()).toContainEqual({ endsOn: { gte: now } })
  })

  it('keeps undated runs only before they start', () => {
    expect(branches()).toContainEqual({ endsOn: null, startsOn: { gte: now } })
  })

  it('never gates a running event on its start date alone', () => {
    // A lone `startsOn >= now` condition is the regression. `startsOn` may
    // legitimately appear alongside `endsOn: null`, but never by itself.
    const startOnly = branches().filter(
      (b) => 'startsOn' in b && !('endsOn' in b) && !('run' in b),
    )
    expect(startOnly).toHaveLength(0)
  })

  it('uses the supplied clock so results are deterministic', () => {
    expect(JSON.stringify(stillOn(new Date('2020-01-01'))))
      .not.toBe(JSON.stringify(stillOn(new Date('2030-01-01'))))
  })
})

/**
 * `hasClosed` is the line between "To see" and "Closed".
 *
 * It exists because the rule was written inline in `GET /saved` and simply
 * absent from `GET /saved/ids`, so the Saved screen counted 3 bookmarks while
 * Profile counted 5 — the same five bookmarks, two different answers. Any
 * screen that counts them now calls this.
 */
describe('hasClosed', () => {
  const now = new Date('2026-08-27T12:00:00.000Z')

  it('treats a run that ended in the past as closed', () => {
    expect(hasClosed(new Date('2026-06-06T00:00:00.000Z'), now)).toBe(true)
  })

  it('keeps a run ending in the future open', () => {
    expect(hasClosed(new Date('2026-09-13T00:00:00.000Z'), now)).toBe(false)
  })

  it('keeps an undated run open', () => {
    // A bookmark with no end date has no deadline to have passed, so it can
    // never archive itself. Treating null as closed would silently empty the
    // list.
    expect(hasClosed(null, now)).toBe(false)
  })

  it('is not fooled by a run ending later the same day', () => {
    // endsOn is a DATE at UTC midnight, so a show closing *today* compares as
    // earlier than a midday `now`. This is the boundary the two screens have to
    // agree on, whichever way it falls.
    const today = new Date('2026-08-27T00:00:00.000Z')
    expect(hasClosed(today, now)).toBe(true)
    expect(hasClosed(today, new Date('2026-08-26T23:00:00.000Z'))).toBe(false)
  })
})
