import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { apiError } from '../lib/errors'

const router = Router()

// ─── GET /api/categories ──────────────────────────────────────────────────────

/**
 * Returns all event categories (id, name, slug, color).
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    })

    res.json(categories)
  } catch (err) {
    console.error(err)
    apiError(res, 500, 'Failed to fetch categories')
  }
})

export default router