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
    const event = await prisma.exhibition.findUnique({
      where: { id },
      include: {
        category: true,
        venue:    true,
        // The detail page colours itself from the first art form, the same
        // field the list endpoint (cities.ts) sends. Without it the page
        // crashed for every show.
        artForms: { select: { artForm: { select: { name: true, slug: true, color: true } } } },
      },
    })

    if (!event) {
      apiError(res, 404, `Exhibition "${id}" not found`)
      return
    }

    // Flatten the join table, as cities.ts does: the client should not have
    // to know it exists.
    res.json({ ...event, artForms: event.artForms.map((j) => j.artForm) })
  } catch (err) {
    console.error(err)
    apiError(res, 500, 'Failed to fetch event')
  }
})

export default router