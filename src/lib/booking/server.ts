import 'server-only'
import { api } from '@convex/_generated/api'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { isServerDataConfigured, serverQuery } from '@/lib/convex/server'
import { mapCustomerBooking } from '@/lib/data/mappers'
import type { CustomerBooking } from '@/lib/types'
import { BOOKING_COOKIE, openBookingAccess, type BookingAccess } from './access'

/** The booking this browser has proven access to (via the encrypted cookie), if any. */
export async function currentBookingAccess(): Promise<BookingAccess | null> {
  // Expiry is checked against the clock, so this must run at request time —
  // never inside a (per-session) prefetch prerender.
  await connection()
  const store = await cookies()
  return openBookingAccess(store.get(BOOKING_COOKIE)?.value)
}

export async function lookupBooking(reference: string, phone: string): Promise<CustomerBooking | null> {
  if (!isServerDataConfigured) return null
  const found = await serverQuery(api.booking.lookup, { reference, phone, now: Date.now() })
  return found ? mapCustomerBooking(found.booking) : null
}
