import { after, NextResponse } from 'next/server'
import { errorResponse, readJson, validationResponse } from '@/lib/api'
import { BOOKING_COOKIE, bookingCookieOptions, sealBookingAccess } from '@/lib/booking/access'
import { appError, toAppError } from '@/lib/booking/errors'
import { notifyAppointment } from '@/lib/notifications/notify'
import { allowRequest, clientIp } from '@/lib/security/rate-limit'
import { createAdminClient, isServerDataConfigured } from '@/lib/supabase/admin'
import type { BookingResult } from '@/lib/types'
import { bookingRequestSchema, fieldErrors } from '@/lib/validation'

/** POST /api/booking — request an appointment. The database decides availability atomically. */
export async function POST(request: Request) {
  if (!isServerDataConfigured) return errorResponse(appError('NOT_CONFIGURED'))

  const parsed = bookingRequestSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error)
    // A filled honeypot means a bot: answer like a validation error, reveal nothing.
    return validationResponse(fields.website ? { form: 'Please check your details and try again.' } : fields)
  }
  const input = parsed.data

  const ip = clientIp(request.headers)
  const [ipOk, phoneOk] = await Promise.all([
    allowRequest('book:ip', ip, 8, 600),
    allowRequest('book:phone', input.phone, 5, 3600),
  ])
  if (!ipOk || !phoneOk) return errorResponse(appError('RATE_LIMITED'))

  const { data, error } = await createAdminClient().rpc('book_appointment', {
    p_service_id: input.serviceId,
    p_stylist_id: input.stylistId,
    p_starts_at: input.startsAt,
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_email: input.email,
    p_notes: input.notes,
    p_policy_accepted: input.policyAccepted,
  })
  if (error) return errorResponse(toAppError(error))

  const row = data as Record<string, string>
  const booking: BookingResult = {
    appointmentId: row.appointment_id,
    reference: row.reference,
    status: row.status as BookingResult['status'],
    stylistId: row.stylist_id,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
  }

  after(() => notifyAppointment(booking.appointmentId, booking.status === 'confirmed' ? 'confirmed' : 'requested'))

  const response = NextResponse.json(
    { booking: { reference: booking.reference, status: booking.status, startsAt: booking.startsAt, endsAt: booking.endsAt } },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  )
  response.cookies.set(BOOKING_COOKIE, sealBookingAccess(booking.reference, input.phone), bookingCookieOptions)
  return response
}
