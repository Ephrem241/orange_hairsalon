import { after, NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, readJson, validationResponse } from '@/lib/api'
import { BOOKING_COOKIE, bookingCookieOptions, sealBookingAccess } from '@/lib/booking/access'
import { appError, toAppError } from '@/lib/booking/errors'
import { appointmentIdForReference, currentBookingAccess } from '@/lib/booking/server'
import { mapCustomerBooking } from '@/lib/data/mappers'
import { notifyAppointment } from '@/lib/notifications/notify'
import { allowRequest, clientIp } from '@/lib/security/rate-limit'
import { createAdminClient, isServerDataConfigured } from '@/lib/supabase/admin'
import { isIsoDate } from '@/lib/time'
import { cancelSchema, fieldErrors, rescheduleSchema } from '@/lib/validation'

const NO_ACCESS = { code: 'NO_ACCESS', status: 401, message: 'Please look up your booking again to continue.' }

/** GET ?date=YYYY-MM-DD — times this booking can move to (same stylist and service). */
export async function GET(request: NextRequest) {
  if (!isServerDataConfigured) return errorResponse(appError('NOT_CONFIGURED'))
  const access = await currentBookingAccess()
  if (!access) return errorResponse(NO_ACCESS)
  const date = request.nextUrl.searchParams.get('date')
  if (!isIsoDate(date)) return validationResponse({ date: 'Choose a date.' })

  const { data, error } = await createAdminClient().rpc('customer_reschedule_slots', {
    p_reference: access.reference,
    p_phone: access.phone,
    p_date: date,
  })
  if (error) return errorResponse(toAppError(error))
  return NextResponse.json(
    { date, slots: (data as string[]).map((s) => ({ startsAt: new Date(s).toISOString(), stylistsFree: 1 })) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

const action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('cancel') }).extend(cancelSchema.shape),
  z.object({ action: z.literal('reschedule') }).extend(rescheduleSchema.shape),
])

/** POST { action: 'cancel', reason } | { action: 'reschedule', startsAt } */
export async function POST(request: Request) {
  if (!isServerDataConfigured) return errorResponse(appError('NOT_CONFIGURED'))
  const access = await currentBookingAccess()
  if (!access) return errorResponse(NO_ACCESS)
  if (!(await allowRequest('manage:ip', clientIp(request.headers), 20, 900))) return errorResponse(appError('RATE_LIMITED'))

  const parsed = action.safeParse(await readJson(request))
  if (!parsed.success) return validationResponse(fieldErrors(parsed.error))

  const db = createAdminClient()
  const result =
    parsed.data.action === 'cancel'
      ? await db.rpc('customer_cancel', { p_reference: access.reference, p_phone: access.phone, p_reason: parsed.data.reason })
      : await db.rpc('customer_reschedule', { p_reference: access.reference, p_phone: access.phone, p_new_start: parsed.data.startsAt })
  if (result.error) return errorResponse(toAppError(result.error))

  const event = parsed.data.action === 'cancel' ? 'cancelled' : 'rescheduled'
  after(async () => {
    const id = await appointmentIdForReference(access.reference)
    if (id) await notifyAppointment(id, event)
  })

  const response = NextResponse.json({ booking: mapCustomerBooking(result.data as Record<string, unknown>) })
  // Refresh the access window after a successful change.
  response.cookies.set(BOOKING_COOKIE, sealBookingAccess(access.reference, access.phone), bookingCookieOptions)
  return response
}
