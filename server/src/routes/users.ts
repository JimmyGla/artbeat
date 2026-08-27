import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma }      from '../lib/prisma'
import { apiError }    from '../lib/errors'
import { requireAuth } from '../middleware/requireAuth'
import { supabase }    from '../lib/supabase'

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

// ─── DELETE /api/users/me ─────────────────────────────────────────────────────
//
// Apple requires an account created in-app to be deletable in-app, and App
// Review checks for it. Removes the Supabase auth identity first, then the
// local row.
//
// That order matters. requireAuth *upserts* the User row from a valid token, so
// deleting locally first would let the very next authenticated request recreate
// the account with the saves gone — the worst of both outcomes. Killing the
// auth identity first makes that impossible; if the local delete then fails we
// are left with an orphan row and no way to sign in, which is recoverable.

router.delete('/me', requireAuth, async (req: Request, res: Response) => {
  const user     = req.user!
  const authId   = req.supabaseUserId

  try {
    if (authId) {
      const { error } = await supabase.auth.admin.deleteUser(authId)
      if (error) {
        console.error('[DELETE /users/me] supabase delete failed', error)
        apiError(res, 502, 'Could not delete your sign-in. Nothing was removed — please try again.')
        return
      }
    } else {
      // No auth id means we cannot revoke sign-in, so refuse rather than
      // delete the data and leave a usable login behind.
      apiError(res, 500, 'Could not identify your sign-in. Nothing was removed.')
      return
    }

    // Favorites and bookmarks cascade from the User row.
    await prisma.user.delete({ where: { id: user.id } })

    res.status(204).send()
  } catch (err) {
    // The auth identity is already gone at this point, so the account is
    // unusable even though rows remain. Loud, because it needs manual cleanup.
    console.error('[DELETE /users/me] local delete failed AFTER auth removal —', user.email, err)
    apiError(res, 500, 'Your sign-in was removed but some data may remain. Contact support.')
  }
})

export default router
