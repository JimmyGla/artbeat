import { Prisma } from '@prisma/client'

/**
 * "Still relevant to someone deciding what to see today."
 *
 * Deliberately NOT `startDate >= now`: exhibitions routinely run for six
 * months, so filtering on start date hides everything currently open — that
 * bug made every venue report zero events.
 *
 *   • run = PERMANENT → always on, no dates involved
 *   • has an end date → still on until that date passes
 *   • no end date     → treated as a one-off, so only before it happens
 *
 * The no-end-date branch is now only a judgement call for TEMPORARY runs:
 * a source that omits an end date for a long show still gets hidden early.
 * Permanent runs no longer depend on that guess at all — they say so. The
 * scraper also reads end dates from the page body, keeping the ambiguous
 * population small; check `npm run db:audit` ("no end date") before
 * revisiting the trade-off.
 *
 * Shared so the events list and the per-venue counts cannot drift apart.
 */
export function stillOn(now: Date = new Date()): Prisma.ExhibitionWhereInput {
  return {
    // Confirmed taken down by a healthy source — kept for history, never shown.
    withdrawnAt: null,
    OR: [
      // Always on, by definition. Previously unrepresentable — this is the
      // branch whose absence made every venue report zero events.
      { run: 'PERMANENT' },
      // Running: has not ended yet.
      { endsOn: { gte: now } },
      // Open-ended single date: only before it happens.
      { endsOn: null, startsOn: { gte: now } },
    ],
  }
}

/**
 * Has a bookmarked run finished?
 *
 * The rule that separates "To see" from "Closed". Deliberately narrower than
 * `stillOn`: a bookmark is a promise *you* made, so it stays in your list until
 * the show actually ends, and it is not filtered by withdrawal or by run type
 * the way a public listing is.
 *
 * Extracted because it was written inline in `GET /saved` while `GET /saved/ids`
 * had no equivalent at all — so the Saved screen said "3 to see" and Profile
 * said "5" about the same bookmarks. Two screens counting the same thing must
 * count it with the same function.
 */
export function hasClosed(endsOn: Date | null, now: Date = new Date()): boolean {
  return Boolean(endsOn && endsOn < now)
}
