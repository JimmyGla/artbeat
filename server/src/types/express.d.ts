import { User } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      user?: User
      /**
       * The Supabase auth id for this request.
       *
       * Our User row is keyed by email and does not store it, so account
       * deletion had no way to reach the auth record. Attached here rather
       * than re-verifying the token in every route that needs it.
       */
      supabaseUserId?: string
    }
  }
}
