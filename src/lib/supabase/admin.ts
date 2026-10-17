import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/env'

const secretKey = process.env.SUPABASE_SECRET_KEY ?? ''

export const isServerDataConfigured = Boolean(supabaseUrl && secretKey)

/**
 * Secret-key client: bypasses row-level security. Used only by server code for
 * the public booking API (whose database functions are executable by this role
 * alone), notifications, rate limiting and staff provisioning. Never import
 * this from a Client Component — `server-only` makes that a build error.
 */
export function createAdminClient(): SupabaseClient {
  if (!isServerDataConfigured) {
    throw new Error('Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.')
  }
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
