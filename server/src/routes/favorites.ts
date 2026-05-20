import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma }      from '../lib/prisma'
import { apiError }    from '../lib/errors'
import { requireAuth } from '../middleware/requireAuth'

const router = Router()

// ─── GET /api/favorites ───────────────────────────────────────────────────────
// Returns all favorited events for the authenticated user,
// in the same shape as the city events list endpoint.

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id

  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        event: {
          include: {
            category: {
              select: { id: true, name: true, slug: true, color: true },
            },
            venue: {
              select: {
                id:      true,
                name:    true,
                type:    true,
                address: true,
                lat:     true,
                lng:     true,
              },
            },
          },
        },
      },
    })

    // Sort: upcoming first, then past; within each group sort by startDate asc
    const now    = new Date()
    const events = favorites.map((f) => f.event)
    events.sort((a, b) => {
      const aUp = new Date(a.startDate) >= now
      const bUp = new Date(b.startDate) >= now
      if (aUp !== bUp) return aUp ? -1 : 1
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    })

    res.json(events)
  } catch (err) {
    console.error('[GET /favorites]', err)
    apiError(res, 500, 'Failed to fetch favorites')
  }
})

// ─── POST /api/favorites ──────────────────────────────────────────────────────

const createSchema = z.object({
  eventId: z.string().uuid('eventId must be a valid UUID'),
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    apiError(res, 400, parsed.error.issues[0]?.message ?? 'Invalid body')
    return
  }

  const { eventId } = parsed.data
  const userId      = req.user!.id

  try {
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) {
      apiError(res, 404, 'Event not found')
      return
    }

    // Upsert so that calling POST twice is idempotent
    const favorite = await prisma.favorite.upsert({
      where:  { userId_eventId: { userId, eventId } },
      create: { userId, eventId },
      update: {},
    })

    res.status(201).json(favorite)
  } catch (err) {
    console.error('[POST /favorites]', err)
    apiError(res, 500, 'Failed to save favorite')
  }
})

// ─── DELETE /api/favorites/:eventId ──────────────────────────────────────────

router.delete('/:eventId', requireAuth, async (req: Request, res: Response) => {
  const { eventId } = req.params
  const userId      = req.user!.id

  try {
    await prisma.favorite.deleteMany({ where: { userId, eventId } })
    res.status(204).send()
  } catch (err) {
    console.error('[DELETE /favorites]', err)
    apiError(res, 500, 'Failed to remove favorite')
  }
})

export default router
