import { describe, it, expect } from 'vitest'
import { fireDateFor, reminderBody, notificationId } from '../reminders'

/**
 * Closing reminders are the one feature nobody can verify by looking at the
 * app: a wrong fire date is invisible until the notification arrives on the
 * wrong day, or never. Date handling in this project has already been wrong
 * twice — Italian DD/MM parsed as MM/DD, and calendar dates shifted by the UTC
 * offset — so the arithmetic is pinned down here instead.
 *
 * `endsOn` always arrives as a DATE column serialised to UTC midnight.
 */

const ends = (iso: string) => ({
  exhibitionId: 'a3f1c2d4-0000-4000-8000-000000000001',
  title: 'I Macchiaioli',
  venueName: 'Palazzo Reale',
  endsOn: iso,
})

describe('fireDateFor', () => {
  it('fires three days before closing, at a civil hour', () => {
    const at = fireDateFor(ends('2026-09-15T00:00:00.000Z'), new Date('2026-08-01T12:00:00Z'))!
    expect(at.getFullYear()).toBe(2026)
    expect(at.getMonth()).toBe(8) // September
    expect(at.getDate()).toBe(12)
    expect(at.getHours()).toBe(10) // local, never midnight
  })

  it('keeps the calendar day the API sent, regardless of local offset', () => {
    // The regression this guards: reading a UTC-midnight DATE with the local
    // getters moves the day backwards for anyone west of UTC, so a show closing
    // on the 15th would be warned about as if it closed on the 14th.
    const at = fireDateFor(ends('2026-09-15T00:00:00.000Z'), new Date('2026-08-01T12:00:00Z'))!
    const closing = new Date(at)
    closing.setDate(closing.getDate() + 3)
    expect(closing.getDate()).toBe(15)
    expect(closing.getMonth()).toBe(8)
  })

  it('still warns when bookmarked inside the three-day window', () => {
    // Bookmarked two days before closing: the ideal moment has passed, but a
    // reminder is still useful. Returning null here would silently drop the
    // reminder for exactly the most urgent bookmarks.
    const now = new Date('2026-09-13T09:00:00Z')
    const at = fireDateFor(ends('2026-09-15T00:00:00.000Z'), now)
    expect(at).not.toBeNull()
    expect(at!.getTime()).toBeGreaterThan(now.getTime())
  })

  it('never schedules in the past', () => {
    const now = new Date('2026-09-14T09:00:00Z')
    const at = fireDateFor(ends('2026-09-15T00:00:00.000Z'), now)
    if (at) expect(at.getTime()).toBeGreaterThan(now.getTime())
  })

  it('gives nothing once the show has closed', () => {
    expect(fireDateFor(ends('2026-09-15T00:00:00.000Z'), new Date('2026-09-20T09:00:00Z'))).toBeNull()
  })

  it('treats the closing day as still open', () => {
    // A show closing today is open today; the user can still make it.
    expect(fireDateFor(ends('2026-09-15T00:00:00.000Z'), new Date('2026-09-15T08:00:00Z'))).not.toBeNull()
  })

  it('gives nothing without an end date', () => {
    // Permanent runs reach here only by mistake, and have no deadline to warn
    // about. Must not throw or schedule on an Invalid Date.
    expect(fireDateFor({ ...ends(''), endsOn: null })).toBeNull()
    expect(fireDateFor({ ...ends('not-a-date') })).toBeNull()
  })

  it('honours an explicit remindAt over the default lead time', () => {
    const at = fireDateFor(
      { ...ends('2026-09-15T00:00:00.000Z'), remindAt: '2026-08-20T07:00:00.000Z' },
      new Date('2026-08-01T12:00:00Z'),
    )
    expect(at!.toISOString()).toBe('2026-08-20T07:00:00.000Z')
  })

  it('ignores a remindAt that has already passed', () => {
    expect(
      fireDateFor(
        { ...ends('2026-09-15T00:00:00.000Z'), remindAt: '2026-07-01T07:00:00.000Z' },
        new Date('2026-08-01T12:00:00Z'),
      ),
    ).toBeNull()
  })
})

describe('reminderBody', () => {
  it('counts days from the fire date to closing', () => {
    const at = new Date(2026, 8, 12, 10, 0, 0)
    expect(reminderBody(ends('2026-09-15T00:00:00.000Z'), at)).toBe('Closes in 3 days at Palazzo Reale.')
  })

  it('reads naturally at one day and on the day', () => {
    expect(reminderBody(ends('2026-09-15T00:00:00.000Z'), new Date(2026, 8, 14, 10)))
      .toBe('Closes tomorrow at Palazzo Reale.')
    expect(reminderBody(ends('2026-09-15T00:00:00.000Z'), new Date(2026, 8, 15, 10)))
      .toBe('Last day at Palazzo Reale.')
  })

  it('omits the venue rather than saying "null"', () => {
    const body = reminderBody({ ...ends('2026-09-15T00:00:00.000Z'), venueName: null }, new Date(2026, 8, 12, 10))
    expect(body).toBe('Closes in 3 days.')
    expect(body).not.toContain('null')
  })
})

describe('notificationId', () => {
  it('is stable, so re-syncing replaces a reminder instead of duplicating it', () => {
    expect(notificationId('abc-123')).toBe(notificationId('abc-123'))
  })

  it('is a non-negative integer, as the plugin requires', () => {
    for (const id of ['a', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', crypto.randomUUID()]) {
      const n = notificationId(id)
      expect(Number.isSafeInteger(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(0)
    }
  })

  it('separates distinct exhibitions', () => {
    const ids = new Set(
      Array.from({ length: 500 }, (_, i) => notificationId(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)),
    )
    // Collisions mean one bookmark silently overwrites another's reminder.
    expect(ids.size).toBeGreaterThan(495)
  })
})
