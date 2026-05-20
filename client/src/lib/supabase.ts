import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/**
 * Client-side Supabase instance.
 * Uses the anon/public key — safe to expose in the browser.
 */
export const supabase = createClient(supabaseUrl, supabaseKey)
