import { createClient } from '@supabase/supabase-js'

const supabaseUrl         = process.env.SUPABASE_URL!
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceRole) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — auth will fail')
}

/**
 * Server-side Supabase client.
 * Uses the service-role key so it can validate user JWTs
 * and perform admin operations.  Never expose this key to the client.
 */
export const supabase = createClient(supabaseUrl ?? '', supabaseServiceRole ?? '', {
  auth: {
    autoRefreshToken: false,
    persistSession:   false,
  },
})
