import { Router, Request, Response } from 'express'
import { prisma }   from '../lib/prisma'
import { apiError } from '../lib/errors'

/**
 * Art forms — the medium. Replaces /api/categories as the filter dimension,
 * because "what is this made of" is more useful to a visitor than "is this an
 * opening". Each carries a colour, which is what tints cards and map pins.
 */
const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const forms = await prisma.artForm.findMany({
      select:  { id: true, name: true, slug: true, color: true },
      orderBy: { name: 'asc' },
    })
    res.json(forms)
  } catch (err) {
    console.error('[GET /art-forms]', err)
    apiError(res, 500, 'Failed to fetch art forms')
  }
})

export default router
