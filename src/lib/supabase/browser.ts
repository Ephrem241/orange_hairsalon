'use client'

import { createBrowserClient } from '@supabase/ssr'
import { supabasePublishableKey, supabaseUrl } from '@/lib/env'

let client: ReturnType<typeof createBrowserClient> | undefined

/** Browser client for the dashboard (media uploads with the staff session). */
export function getBrowserClient() {
  client ??= createBrowserClient(supabaseUrl, supabasePublishableKey)
  return client
}
