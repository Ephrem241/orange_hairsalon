import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * Short-lived proof that this browser may view a booking.
 *
 * Booking pages are never reachable by URL alone: after booking, or after a
 * successful reference + phone lookup, the server sets an httpOnly cookie
 * holding { reference, phone, exp }, encrypted and authenticated with
 * AES-256-GCM. The phone is needed again for the database's self-service
 * functions; encryption keeps it unreadable even on the visitor's device.
 */
export const BOOKING_COOKIE = 'os_booking'
export const BOOKING_ACCESS_TTL_SECONDS = 30 * 60

export type BookingAccess = { reference: string; phone: string; exp: number }

function key(): Buffer {
  const secret = process.env.BOOKING_COOKIE_SECRET
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('BOOKING_COOKIE_SECRET must be set to at least 32 random characters.')
    }
    return createHash('sha256').update('orange-salon-development-only-secret').digest()
  }
  return createHash('sha256').update(secret).digest()
}

export function sealBookingAccess(reference: string, phone: string, now = Date.now()): string {
  const payload: BookingAccess = { reference, phone, exp: Math.floor(now / 1000) + BOOKING_ACCESS_TTL_SECONDS }
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64url')).join('.')
}

export function openBookingAccess(token: string | undefined, now = Date.now()): BookingAccess | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const [iv, tag, body] = parts.map((p) => Buffer.from(p, 'base64url'))
    const decipher = createDecipheriv('aes-256-gcm', key(), iv)
    decipher.setAuthTag(tag)
    const json = Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
    const payload = JSON.parse(json) as BookingAccess
    if (typeof payload.reference !== 'string' || typeof payload.phone !== 'string' || typeof payload.exp !== 'number') return null
    if (payload.exp * 1000 < now) return null
    return payload
  } catch {
    return null // tampered, truncated or encrypted with another key
  }
}

export const bookingCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: BOOKING_ACCESS_TTL_SECONDS,
}
