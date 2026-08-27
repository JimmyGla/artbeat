import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// createClient() throws a bare "supabaseUrl is required." at module load if
// these are absent, which kills the bundle before React mounts — inside the
// native WebView that surfaces as a blank screen with no clue why.  Fail with
// an actionable message instead.
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. ' +
    'Copy client/.env.example to client/.env, fill it in, then re-run ' +
    '`npm run build:mobile`.',
  )
}

/**
 * Client-side Supabase instance.
 * Uses the anon/public key — safe to expose in the browser.
 */
export const supabase = createClient(supabaseUrl, supabaseKey)
