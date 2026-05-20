import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { prisma }   from '../lib/prisma'
import { apiError } from '../lib/errors'

/**
 * Validates the Bearer JWT from the Authorization header using Supabase,
 * then upserts the user into our Prisma User table and attaches req.user.
 */
export async function requireAuth(
  req:  Request,
  res:  Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    apiError(res, 401, 'Missing or invalid Authorization header')
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const { data: { user: sbUser }, error } = await supabase.auth.getUser(token)

    if (error || !sbUser?.email) {
      apiError(res, 401, 'Invalid or expired token')
      return
    }

    const provider =
      sbUser.app_metadata?.provider === 'google' ? 'GOOGLE' : 'EMAIL'

    const user = await prisma.user.upsert({
      where:  { email: sbUser.email },
      create: {
        email:        sbUser.email,
        name:         (sbUser.user_metadata?.full_name as string) ?? null,
        avatarUrl:    (sbUser.user_metadata?.avatar_url as string) ?? null,
        authProvider: provider,
      },
      update: {
        name:      (sbUser.user_metadata?.full_name as string)  ?? undefined,
        avatarUrl: (sbUser.user_metadata?.avatar_url as string) ?? undefined,
      },
    })

    req.user = user
    next()
  } catch (err) {
    console.error('[requireAuth]', err)
    apiError(res, 500, 'Authentication failed')
  }
}
