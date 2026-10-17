import 'server-only'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { mapCustomerBooking } from '@/lib/data/mappers'
import { createAdminClient, isServerDataConfigured } from '@/lib/supabase/admin'
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
  const { data, error } = await createAdminClient().rpc('customer_lookup', { p_reference: reference, p_phone: phone })
  if (error) throw error
  return data ? mapCustomerBooking(data as Record<string, unknown>) : null
}

export async function appointmentIdForReference(reference: string): Promise<string | null> {
  const { data } = await createAdminClient().from('appointments').select('id').eq('reference', reference).maybeSingle()
  return (data?.id as string | undefined) ?? null
}
