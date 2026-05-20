/**
 * Admin routes — NOT authenticated via Supabase JWT.
 *
 * These endpoints are intended for use from a trusted backend environment
 * (CI script, Postman, cron job) and are protected by a shared secret passed
 * in the `x-admin-secret` header.
 *
 * Set ADMIN_SECRET in your .env file.  If it is not set the middleware will
 * reject all requests with 403.
 */

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { apiError } from '../lib/errors'

const router = Router()

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireAdminSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    apiError(res, 403, 'Admin secret not configured')
    return
  }
  if (req.headers['x-admin-secret'] !== secret) {
    apiError(res, 403, 'Invalid admin secret')
    return
  }
  next()
}

router.use(requireAdminSecret)

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const createCitySchema = z.object({
  name:      z.string().min(1).max(80),
  slug:      z.string().min(1).max(40).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  country:   z.string().min(1).max(80),
  lat:       z.number().min(-90).max(90),
  lng:       z.number().min(-180).max(180),
  zoomLevel: z.number().int().min(1).max(20).default(13),
  isActive:  z.boolean().default(false),
})

const updateCitySchema = z.object({
  name:      z.string().min(1).max(80).optional(),
  country:   z.string().min(1).max(80).optional(),
  lat:       z.number().min(-90).max(90).optional(),
  lng:       z.number().min(-180).max(180).optional(),
  zoomLevel: z.number().int().min(1).max(20).optional(),
  isActive:  z.boolean().optional(),
}).strict()

// ─── POST /api/admin/cities — create a new city ───────────────────────────────

router.post('/cities', async (req: Request, res: Response) => {
  const parsed = createCitySchema.safeParse(req.body)
  if (!parsed.success) {
    apiError(res, 400, parsed.error.issues.map((i) => i.message).join('; '))
    return
  }

  const { name, slug, country, lat, lng, zoomLevel, isActive } = parsed.data

  // Check for duplicate slug
  const existing = await prisma.city.findUnique({ where: { slug } })
  if (existing) {
    apiError(res, 409, `City with slug "${slug}" already exists`)
    return
  }

  try {
    const city = await prisma.city.create({
      data: { name, slug, country, lat, lng, zoomLevel, isActive },
    })
    res.status(201).json(city)
  } catch (err) {
    console.error(err)
    apiError(res, 500, 'Failed to create city')
  }
})

// ─── PATCH /api/admin/cities/:slug — update an existing city ─────────────────

router.patch('/cities/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params
  const parsed   = updateCitySchema.safeParse(req.body)
  if (!parsed.success) {
    apiError(res, 400, parsed.error.issues.map((i) => i.message).join('; '))
    return
  }

  const city = await prisma.city.findUnique({ where: { slug } })
  if (!city) {
    apiError(res, 404, `City "${slug}" not found`)
    return
  }

  try {
    const updated = await prisma.city.update({
      where: { slug },
      data:  parsed.data,
    })
    res.json(updated)
  } catch (err) {
    console.error(err)
    apiError(res, 500, 'Failed to update city')
  }
})

export default router
