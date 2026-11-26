import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase }   from '../lib/supabase'
import { prisma }     from '../lib/prisma'
import { apiError }   from '../lib/errors'
import { requireAuth } from '../middleware/requireAuth'

const router = Router()

// ─── POST /api/auth/register ─────────────────────────────────────────────────

const registerSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  name:     z.string().min(1).optional(),
})

router.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    apiError(res, 400, parsed.error.issues[0]?.message ?? 'Invalid body')
    return
  }

  const { email, password, name } = parsed.data

  try {
    const { error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name ?? email.split('@')[0] },
      })

    if (createError) {
      apiError(res, 400, createError.message)
      return
    }

    // Sign in immediately to get a session token
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password })

    if (signInError || !signInData.session) {
      apiError(res, 500, 'Registration succeeded but sign-in failed')
      return
    }

    // Upsert into our Prisma User table
    const user = await prisma.user.upsert({
      where:  { email },
      create: {
        email,
        name:         name ?? null,
        authProvider: 'EMAIL',
      },
      update: { name: name ?? undefined },
    })

    res.status(201).json({
      token: signInData.session.access_token,
      user:  { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    })
  } catch (err) {
    console.error('[auth/register]', err)
    apiError(res, 500, 'Registration failed')
  }
})

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    apiError(res, 400, 'email and password are required')
    return
  }

  const { email, password } = parsed.data

  try {
    const { data, error } =
      await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.session) {
      apiError(res, 401, 'Invalid email or password')
      return
    }

    const user = await prisma.user.upsert({
      where:  { email },
      create: {
        email,
        name:         (data.user.user_metadata?.full_name as string) ?? null,
        avatarUrl:    (data.user.user_metadata?.avatar_url as string) ?? null,
        authProvider: 'EMAIL',
      },
      update: {},
    })

    res.json({
      token: data.session.access_token,
      user:  { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    })
  } catch (err) {
    console.error('[auth/login]', err)
    apiError(res, 500, 'Login failed')
  }
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', requireAuth, (req: Request, res: Response) => {
  const u = req.user!
  res.json({ id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl })
})

// ─── GET /api/auth/google ─────────────────────────────────────────────────────

router.get('/google', async (req: Request, res: Response) => {
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options:  { redirectTo: `${clientUrl}/auth/callback` },
  })

  if (error || !data.url) {
    apiError(res, 500, 'Failed to initiate Google OAuth')
    return
  }

  res.redirect(data.url)
})

// ─── GET /api/auth/google/callback ────────────────────────────────────────────
// Supabase handles the actual exchange; we just redirect the browser back
// to the client so Supabase JS can pick up the session from the URL hash.

router.get('/google/callback', (_req: Request, res: Response) => {
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
  res.redirect(`${clientUrl}/auth/callback`)
})

export default router
