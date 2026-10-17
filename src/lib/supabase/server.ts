import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabasePublishableKey, supabaseUrl } from '@/lib/env'

/**
 * Per-request client carrying the signed-in staff member's session. Every
 * query runs as that user, so row-level security and the role checks inside
 * the database functions apply. Create a new one for each request.
 */
export async function createSessionClient() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options)
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy refreshes the session on the next request instead.
        }
      },
    },
  })
}
