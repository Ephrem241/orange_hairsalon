import 'server-only'
import { createHash } from 'node:crypto'
import { createAdminClient, isServerDataConfigured } from '@/lib/supabase/admin'

/** Best-effort client IP behind Vercel's proxy (the first X-Forwarded-For hop). */
export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
}

/** Raw IPs and phone numbers are never stored: keys are salted hashes. */
export function rateLimitKey(scope: string, identifier: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? 'orange-salon'
  return `${scope}:${createHash('sha256').update(`${salt}:${identifier}`).digest('base64url').slice(0, 32)}`
}

/**
 * Fixed-window limit stored in Postgres (works across serverless instances).
 * Returns true when the request may proceed. Fails open if the limiter itself
 * errors, so an infrastructure hiccup never blocks genuine bookings — the
 * database constraints still protect integrity.
 */
export async function allowRequest(scope: string, identifier: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!isServerDataConfigured) return true
  const { data, error } = await createAdminClient().rpc('consume_rate_limit', {
    p_key: rateLimitKey(scope, identifier),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) {
    console.error('[rate-limit] limiter unavailable, allowing request', error.message)
    return true
  }
  return data === true
}
