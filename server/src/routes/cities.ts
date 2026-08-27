import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { apiError } from '../lib/errors'
import { getExhibitionsNearPoint } from '../lib/geo'
import { stillOn } from '../lib/eventFilters'

const router = Router()

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const eventsQuerySchema = z.object({
  /** Filter by medium (ArtForm slug) — replaces the old `category` param. */
  artForm:  z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
  free:     z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  /**
   * Finished events are excluded by default — a discovery app showing closed
   * exhibitions is worse than showing fewer.  Opt in with `includeEnded=true`
   * for archive or debugging views.
   */
  includeEnded: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

const nearbyQuerySchema = z.object({
  lat:    z.coerce.number().min(-90).max(90),
  lng:    z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(100),
})

// ─── GET /api/cities ──────────────────────────────────────────────────────────
// Returns ALL cities (active + inactive) so the client can show coming-soon cities.
// The `isActive` field is included so the CitySelector can grey out inactive ones.

router.get('/', async (_req: Request, res: Response) => {
  try {
    const cities = await prisma.city.findMany({
      include: { _count: { select: { venues: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    })

    res.json(cities.map((c) => ({
      id:         c.id,
      name:       c.name,
      slug:       c.slug,
      country:    c.country,
      lat:        c.lat,
      lng:        c.lng,
      zoomLevel:  c.zoomLevel,
      isActive:   c.isActive,
      venueCount: c._count.venues,
    })))
  } catch (err) {
    console.error(err)
    apiError(res, 500, 'Failed to fetch cities')
  }
})

// ─── GET /api/cities/:slug/events/nearby ─────────────────────────────────────

router.get(['/:slug/exhibitions/nearby', '/:slug/events/nearby'], async (req: Request, res: Response) => {
  const { slug } = req.params
  const parsed = nearbyQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    apiError(res, 400, parsed.error.issues.map((i) => i.message).join('; '))
    return
  }
  const { lat, lng, radius } = parsed.data
  try {
    res.json(await getExhibitionsNearPoint(lat, lng, radius, slug))
  } catch (err) {
    console.error(err)
    apiError(res, 500, 'Failed to fetch nearby events')
  }
})

// ─── GET /api/cities/:slug/exhibitions ───────────────────────────────────────
// `/events` stays mounted as a deprecated alias for shipped app builds.

router.get(['/:slug/exhibitions', '/:slug/events'], async (req: Request, res: Response) => {
  const { slug } = req.params
  const parsed = eventsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    apiError(res, 400, parsed.error.issues.map((i) => i.message).join('; '))
    return
  }
  const { artForm, dateFrom, dateTo, free, includeEnded } = parsed.data

  const city = await prisma.city.findUnique({ where: { slug } })
  if (!city) { apiError(res, 404, `City "${slug}" not found`); return }

  try {
    const events = await prisma.exhibition.findMany({
      where: {
        venue: { city: { slug } },
        ...(artForm  && { artForms: { some: { artForm: { slug: artForm } } } }),
        ...(dateFrom  && { startsOn: { gte: dateFrom } }),
        ...(dateTo    && { startsOn: { lte: dateTo   } }),
        // Free now means free, not "no price recorded".
        ...(free      && { admission: 'FREE' as const }),
        ...(includeEnded ? {} : stillOn()),
      },
      select: {
        id:         true,
        title:      true,
        run:        true,
        format:     true,
        startsOn:   true,
        endsOn:     true,
        admission:  true,
        priceCents: true,
        imageUrl:   true,
        // `isPlaceholder` is reported rather than filtered: this one endpoint
        // feeds both Discover (which should list these events) and the map
        // (which must not pin them). The caller decides.
        venue:      { select: { id: true, name: true, lat: true, lng: true, kind: true, isPlaceholder: true } },
        artForms:   { select: { artForm: { select: { name: true, slug: true, color: true } } } },
      },
      // Permanent runs have no start date, so they sort last under `asc`
      // regardless — order by run first to make that explicit rather than
      // accidental.
      orderBy: [{ run: 'asc' }, { startsOn: 'asc' }],
    })

    // Flatten the join table: the client should not have to know it exists.
    res.json(events.map((e) => ({
      ...e,
      artForms: e.artForms.map((j) => j.artForm),
    })))
  } catch (err) {
    console.error(err)
    apiError(res, 500, 'Failed to fetch events')
  }
})

// ─── GET /api/cities/:slug/venues ────────────────────────────────────────────

router.get('/:slug/venues', async (req: Request, res: Response) => {
  const { slug } = req.params
  const city = await prisma.city.findUnique({ where: { slug } })
  if (!city) { apiError(res, 404, `City "${slug}" not found`); return }

  try {
    // Same predicate the events list uses — see lib/eventFilters.
    const stillOnFilter = stillOn()

    const venues = await prisma.venue.findMany({
      // Placeholders are a bookkeeping device for events with no confirmed
      // location — not real places, so they never appear in the venue list.
      where: { city: { slug }, isPlaceholder: false },
      include: {
        _count: { select: { exhibitions: { where: stillOnFilter } } },
        exhibitions: {
          where:   { ...stillOnFilter, imageUrl: { not: null } },
          select:  { imageUrl: true },
          orderBy: { startsOn: 'asc' },
          take:    1,
        },
      },
      orderBy: { name: 'asc' },
    })
    res.json(venues.map((v) => ({
      id:                 v.id,
      name:               v.name,
      description:        v.description,
      address:            v.address,
      lat:                v.lat,
      lng:                v.lng,
      kind:               v.kind,
      imageUrl:           v.imageUrl ?? v.exhibitions[0]?.imageUrl ?? null,
      website:            v.website,
      upcomingEventCount: v._count.exhibitions,
    })))
  } catch (err) {
    console.error(err)
    apiError(res, 500, 'Failed to fetch venues')
  }
})

export default router
