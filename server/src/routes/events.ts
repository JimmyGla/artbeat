import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { apiError } from '../lib/errors'

const router = Router()

// ─── GET /api/events/:id ──────────────────────────────────────────────────────

/**
 * Returns full event detail including the complete venue object
 * (address, website, coordinates) and category.
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        category: true,
        venue:    true,
      },
    })

    if (!event) {
      apiError(res, 404, `Event "${id}" not found`)
      return
    }

    res.json(event)
  } catch (err) {
    console.error(err)
    apiError(res, 500, 'Failed to fetch event')
  }
})

export default router