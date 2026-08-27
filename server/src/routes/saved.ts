import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma }      from '../lib/prisma'
import { apiError }    from '../lib/errors'
import { requireAuth } from '../middleware/requireAuth'
import { stillOn, hasClosed } from '../lib/eventFilters'

/**
 * Two ways to save something, because they mean different things.
 *
 *   Heart / favourite → taste. Venues and PERMANENT runs: things that persist
 *                       and have no deadline.
 *   Bookmark          → intent. TEMPORARY runs: a task with an expiry date,
 *                       which is why the list can sort by closing soonest and
 *                       archive itself.
 *
 * The object's nature decides which verb applies, so the API refuses the wrong
 * one rather than letting the client choose. That is what keeps the UI from
 * ever showing two save buttons on the same thing.
 */

const router = Router()

const exhibitionSelect = {
  id:         true,
  title:      true,
  run:        true,
  format:     true,
  startsOn:   true,
  endsOn:     true,
  admission:  true,
  priceCents: true,
  imageUrl:   true,
  venue:      { select: { id: true, name: true, kind: true, lat: true, lng: true, isPlaceholder: true } },
  artForms:   { select: { artForm: { select: { name: true, slug: true, color: true } } } },
} as const

const flatten = <T extends { artForms: { artForm: unknown }[] }>(e: T) => ({
  ...e,
  artForms: e.artForms.map((j) => j.artForm),
})

// ─── GET /api/saved ──────────────────────────────────────────────────────────
// Everything the user has saved, already split into the two lists the
// Favorites screen renders. One request, because the screen shows both.

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id

  try {
    const [favorites, bookmarks] = await Promise.all([
      prisma.favorite.findMany({
        where:   { userId },
        include: {
          venue: { select: { id: true, name: true, kind: true, address: true, lat: true, lng: true, imageUrl: true } },
          exhibition: { select: exhibitionSelect },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bookmark.findMany({
        where:   { userId },
        include: { exhibition: { select: exhibitionSelect } },
      }),
    ])

    const now = new Date()

    // "To see" earns its keep by being ordered by urgency: whatever closes
    // soonest is what you might still miss. Undated runs sort last.
    const active = bookmarks
      .filter((b) => !hasClosed(b.exhibition.endsOn, now))
      .sort((a, b) => {
        const ax = a.exhibition.endsOn?.getTime() ?? Number.MAX_SAFE_INTEGER
        const bx = b.exhibition.endsOn?.getTime() ?? Number.MAX_SAFE_INTEGER
        return ax - bx
      })

    // Ended bookmarks are not deleted — they move aside, so the live list
    // stays trustworthy without losing history.
    const archived = bookmarks.filter((b) => hasClosed(b.exhibition.endsOn, now))

    res.json({
      places: favorites.map((f) => ({
        id:         f.id,
        createdAt:  f.createdAt,
        venue:      f.venue,
        exhibition: f.exhibition ? flatten(f.exhibition) : null,
      })),
      toSee:    active.map((b)   => ({ id: b.id, remindAt: b.remindAt, exhibition: flatten(b.exhibition) })),
      archived: archived.map((b) => ({ id: b.id, exhibition: flatten(b.exhibition) })),
    })
  } catch (err) {
    console.error('[GET /saved]', err)
    apiError(res, 500, 'Failed to fetch saved items')
  }
})

// ─── Favourites (the heart) ──────────────────────────────────────────────────

const favoriteSchema = z
  .object({
    venueId: z.string().uuid().optional(),
    exhibitionId: z.string().uuid().optional(),
  })
  .refine((b) => Boolean(b.venueId) !== Boolean(b.exhibitionId), {
    message: 'Provide exactly one of venueId or exhibitionId',
  })

router.post('/favorites', requireAuth, async (req: Request, res: Response) => {
  const parsed = favoriteSchema.safeParse(req.body)
  if (!parsed.success) {
    apiError(res, 400, parsed.error.issues[0]?.message ?? 'Invalid body')
    return
  }

  const { venueId, exhibitionId } = parsed.data
  const userId = req.user!.id

  try {
    if (venueId) {
      const venue = await prisma.venue.findUnique({ where: { id: venueId } })
      if (!venue) { apiError(res, 404, 'Venue not found'); return }

      const favorite = await prisma.favorite.upsert({
        where:  { userId_venueId: { userId, venueId } },
        create: { userId, venueId },
        update: {},
      })
      res.status(201).json(favorite)
      return
    }

    const exhibition = await prisma.exhibition.findUnique({ where: { id: exhibitionId! } })
    if (!exhibition) { apiError(res, 404, 'Exhibition not found'); return }

    // A temporary show has a deadline, so it belongs on the bookmark list.
    // Refusing here is what stops the two verbs blurring back together.
    if (exhibition.run !== 'PERMANENT') {
      apiError(res, 409, 'Temporary exhibitions are bookmarked, not favourited. POST /api/saved/bookmarks instead.')
      return
    }

    const favorite = await prisma.favorite.upsert({
      where:  { userId_exhibitionId: { userId, exhibitionId: exhibitionId! } },
      create: { userId, exhibitionId: exhibitionId! },
      update: {},
    })
    res.status(201).json(favorite)
  } catch (err) {
    console.error('[POST /saved/favorites]', err)
    apiError(res, 500, 'Failed to save favourite')
  }
})

router.delete('/favorites/venue/:venueId', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.favorite.deleteMany({ where: { userId: req.user!.id, venueId: req.params.venueId } })
    res.status(204).send()
  } catch (err) {
    console.error('[DELETE /saved/favorites/venue]', err)
    apiError(res, 500, 'Failed to remove favourite')
  }
})

// Both spellings. The client sends `/exhibition/`, this route was written as
// `/event/`, and nothing caught it: a string path is invisible to typecheck, and
// the failure is silent — the optimistic un-heart rolls back and the heart just
// reappears, which reads as a UI glitch rather than a 404.
router.delete(['/favorites/exhibition/:exhibitionId', '/favorites/event/:exhibitionId'], requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.favorite.deleteMany({ where: { userId: req.user!.id, exhibitionId: req.params.exhibitionId } })
    res.status(204).send()
  } catch (err) {
    console.error('[DELETE /saved/favorites/event]', err)
    apiError(res, 500, 'Failed to remove favourite')
  }
})

// ─── Bookmarks ───────────────────────────────────────────────────────────────

const bookmarkSchema = z.object({
  exhibitionId:  z.string().uuid('exhibitionId must be a valid UUID'),
  remindAt: z.coerce.date().optional(),
})

router.post('/bookmarks', requireAuth, async (req: Request, res: Response) => {
  const parsed = bookmarkSchema.safeParse(req.body)
  if (!parsed.success) {
    apiError(res, 400, parsed.error.issues[0]?.message ?? 'Invalid body')
    return
  }

  const { exhibitionId, remindAt } = parsed.data
  const userId = req.user!.id

  try {
    const exhibition = await prisma.exhibition.findUnique({ where: { id: exhibitionId } })
    if (!exhibition) { apiError(res, 404, 'Exhibition not found'); return }

    if (exhibition.run === 'PERMANENT') {
      apiError(res, 409, 'Permanent exhibitions are favourited, not bookmarked. POST /api/saved/favorites instead.')
      return
    }

    const bookmark = await prisma.bookmark.upsert({
      where:  { userId_exhibitionId: { userId, exhibitionId } },
      create: { userId, exhibitionId, remindAt: remindAt ?? null },
      update: { remindAt: remindAt ?? null },
    })
    res.status(201).json(bookmark)
  } catch (err) {
    console.error('[POST /saved/bookmarks]', err)
    apiError(res, 500, 'Failed to save bookmark')
  }
})

router.delete('/bookmarks/:exhibitionId', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.bookmark.deleteMany({ where: { userId: req.user!.id, exhibitionId: req.params.exhibitionId } })
    res.status(204).send()
  } catch (err) {
    console.error('[DELETE /saved/bookmarks]', err)
    apiError(res, 500, 'Failed to remove bookmark')
  }
})

// ─── GET /api/saved/ids ──────────────────────────────────────────────────────
// Just the identifiers, so cards can render their saved state without pulling
// every full record on app start.

router.get('/ids', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id
  try {
    const [favorites, bookmarks] = await Promise.all([
      prisma.favorite.findMany({ where: { userId }, select: { venueId: true, exhibitionId: true } }),
      prisma.bookmark.findMany({
        where:  { userId },
        select: { exhibitionId: true, exhibition: { select: { endsOn: true } } },
      }),
    ])

    const now = new Date()

    res.json({
      venueIds:       favorites.map((f) => f.venueId).filter(Boolean),
      exhibitionIds:  favorites.map((f) => f.exhibitionId).filter(Boolean),

      // Every bookmark, including closed ones. This drives the filled/unfilled
      // state of the save button, and a closed show is still bookmarked — drop
      // it here and its card renders unsaved, so tapping it would try to create
      // a bookmark that already exists.
      bookmarkedIds:  bookmarks.map((b) => b.exhibitionId),

      // The subset that has finished, so the client can count "to see" without
      // fetching every full record. Sent as the closed subset rather than a
      // bare count so the two lists can never disagree about which is which.
      archivedIds:    bookmarks
        .filter((b) => hasClosed(b.exhibition.endsOn, now))
        .map((b) => b.exhibitionId),
    })
  } catch (err) {
    console.error('[GET /saved/ids]', err)
    apiError(res, 500, 'Failed to fetch saved ids')
  }
})

/**
 * Everything the device needs to schedule closing reminders, and nothing else.
 *
 * Reminders are *local* notifications: the closing date is known the moment you
 * bookmark, so the device schedules them itself. No push, no APNs, no server
 * cron — and they still fire with the API down or the phone offline.
 *
 * `/ids` can't drive this (it carries no dates) and `/` returns full records
 * including images and descriptions. This returns the four fields the scheduler
 * reads, so the sync on every app open stays cheap.
 *
 * Only TEMPORARY runs with a real end date can close, so only those are listed:
 * a permanent collection has no deadline to warn about.
 */
router.get('/reminders', requireAuth, async (req: Request, res: Response) => {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId: req.user!.id,
        exhibition: { run: 'TEMPORARY', endsOn: { not: null }, withdrawnAt: null },
      },
      select: {
        remindAt: true,
        exhibition: {
          select: { id: true, title: true, endsOn: true, venue: { select: { name: true } } },
        },
      },
    })

    res.json({
      reminders: bookmarks.map((b) => ({
        exhibitionId: b.exhibition.id,
        title:        b.exhibition.title,
        venueName:    b.exhibition.venue?.name ?? null,
        endsOn:       b.exhibition.endsOn,
        remindAt:     b.remindAt,
      })),
    })
  } catch (err) {
    console.error('[GET /saved/reminders]', err)
    apiError(res, 500, 'Failed to fetch reminders')
  }
})

/**
 * New exhibitions at the venues the user follows.
 *
 * This is the venue-alert *computation*, decoupled from delivery. Push is the
 * eventual transport, but it needs an APNs key and so a paid Apple Developer
 * account, and building a send pipeline that cannot be run would be untestable
 * code guarding untested logic. In-app, the same query is useful immediately —
 * and when push arrives it becomes a delivery channel over this, not a rewrite.
 *
 * "New" means created after `venueAlertsSeenAt`. A null marker falls back to the
 * account's own creation date: for a new sign-in every exhibition in the city is
 * technically unseen, and reporting 200 updates on day one is noise, not news.
 */
router.get('/updates', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!
  try {
    const hearted = await prisma.favorite.findMany({
      where:  { userId: user.id, venueId: { not: null } },
      select: { venueId: true },
    })
    const venueIds = hearted.map((f) => f.venueId!).filter(Boolean)
    if (!venueIds.length) {
      res.json({ since: null, updates: [] })
      return
    }

    const since = user.venueAlertsSeenAt ?? user.createdAt

    const updates = await prisma.exhibition.findMany({
      where: {
        venueId:   { in: venueIds },
        createdAt: { gt: since },
        ...stillOn(),
      },
      // Newest first, and capped: this feeds a glanceable list, not an archive.
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, title: true, startsOn: true, endsOn: true, run: true,
        imageUrl: true, createdAt: true,
        venue: { select: { id: true, name: true } },
      },
    })

    res.json({ since, updates })
  } catch (err) {
    console.error('[GET /saved/updates]', err)
    apiError(res, 500, 'Failed to fetch updates')
  }
})

/** Marks the list read. Separate from GET so opening the screen is what clears it. */
router.post('/updates/seen', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data:  { venueAlertsSeenAt: new Date() },
    })
    res.status(204).send()
  } catch (err) {
    console.error('[POST /saved/updates/seen]', err)
    apiError(res, 500, 'Failed to mark updates seen')
  }
})

export default router
