import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from '@/lib/env'

/**
 * Anonymous, cookie-free client for public reads. Safe inside `'use cache'`
 * scopes: it never touches request data, and row-level security limits it to
 * published content.
 */
export function createPublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
