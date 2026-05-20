import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma }      from '../lib/prisma'
import { apiError }    from '../lib/errors'
import { requireAuth } from '../middleware/requireAuth'

const router = Router()

// ─── PATCH /api/users/me ──────────────────────────────────────────────────────

const patchSchema = z.object({
  name:      z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url('avatarUrl must be a valid URL').optional().nullable(),
}).strict()

router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  const parsed = patchSchema.safeParse(req.body)
  if (!parsed.success) {
    apiError(res, 400, parsed.error.issues[0]?.message ?? 'Invalid body')
    return
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    apiError(res, 400, 'No fields provided to update')
    return
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data:  updates,
    })

    res.json({
      id:        user.id,
      email:     user.email,
      name:      user.name,
      avatarUrl: user.avatarUrl,
    })
  } catch (err) {
    console.error('[PATCH /users/me]', err)
    apiError(res, 500, 'Failed to update profile')
  }
})

export default router
