import 'server-only'
import { createHash } from 'node:crypto'
import { api } from '@convex/_generated/api'
import { isServerDataConfigured, serverMutation } from '@/lib/convex/server'

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
 * Fixed-window limit stored in Convex (works across serverless instances).
 * Returns true when the request may proceed. Fails open if the limiter itself
 * errors, so an infrastructure hiccup never blocks genuine bookings — the
 * booking engine still protects integrity.
 */
export async function allowRequest(scope: string, identifier: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!isServerDataConfigured) return true
  try {
    return await serverMutation(api.rateLimit.consume, { key: rateLimitKey(scope, identifier), limit, windowSeconds })
  } catch (error) {
    console.error('[rate-limit] limiter unavailable, allowing request', (error as Error).message)
    return true
  }
}
