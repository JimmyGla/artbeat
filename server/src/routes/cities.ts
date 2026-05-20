import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { apiError } from '../lib/errors'
import { getEventsNearPoint } from '../lib/geo'

const router = Router()

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const eventsQuerySchema = z.object({
  category: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
  free:     z
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

router.get('/:slug/events/nearby', async (req: Request, res: Response) => {
  const { slug } = req.params
  const parsed = nearbyQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    apiError(res, 400, parsed.error.issues.map((i) => i.message).join('; '))
    return
  }
  const { lat, lng, radius } = parsed.data
  try {
    res.json(await getEventsNearPoint(lat, lng, radius, slug))
  } catch (err) {
    console.error(err)
    apiError(res, 500, 'Failed to fetch nearby events')
  }
})

// ─── GET /api/cities/:slug/events ────────────────────────────────────────────

router.get('/:slug/events', async (req: Request, res: Response) => {
  const { slug } = req.params
  const parsed = eventsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    apiError(res, 400, parsed.error.issues.map((i) => i.message).join('; '))
    return
  }
  const { category, dateFrom, dateTo, free } = parsed.data

  const city = await prisma.city.findUnique({ where: { slug } })
  if (!city) { apiError(res, 404, `City "${slug}" not found`); return }

  try {
    const events = await prisma.event.findMany({
      where: {
        venue: { city: { slug } },
        ...(category && { category: { slug: category } }),
        ...(dateFrom  && { startDate: { gte: dateFrom } }),
        ...(dateTo    && { startDate: { lte: dateTo   } }),
        ...(free      && { price: null }),
      },
      select: {
        id:        true,
        title:     true,
        startDate: true,
        endDate:   true,
        price:     true,
        imageUrl:  true,
        category: { select: { name: true, color: true, slug: true } },
        venue:    { select: { name: true, lat: true, lng: true, type: true } },
      },
      orderBy: { startDate: 'asc' },
    })
    res.json(events)
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
    const venues = await prisma.venue.findMany({
      where: { city: { slug } },
      include: { _count: { select: { events: { where: { startDate: { gte: new Date() } } } } } },
      orderBy: { name: 'asc' },
    })
    res.json(venues.map((v) => ({
      id:                 v.id,
      name:               v.name,
      description:        v.description,
      address:            v.address,
      lat:                v.lat,
      lng:                v.lng,
      type:               v.type,
      imageUrl:           v.imageUrl,
      website:            v.website,
      upcomingEventCount: v._count.events,
    })))
  } catch (err) {
    console.error(err)
    apiError(res, 500, 'Failed to fetch venues')
  }
})

export default router
