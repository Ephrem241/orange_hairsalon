import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { after, NextResponse } from 'next/server'
import { errorResponse, readJson, validationResponse } from '@/lib/api'
import { BOOKING_COOKIE, bookingCookieOptions, sealBookingAccess } from '@/lib/booking/access'
import { appError, toAppError } from '@/lib/booking/errors'
import { notifyAppointment } from '@/lib/notifications/notify'
import { allowRequest, clientIp } from '@/lib/security/rate-limit'
import { isServerDataConfigured, serverMutation } from '@/lib/convex/server'
import type { BookingResult } from '@/lib/types'
import { bookingRequestSchema, fieldErrors } from '@/lib/validation'

/** POST /api/booking — request an appointment. Convex decides availability atomically. */
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

  let booking: BookingResult
  try {
    const row = await serverMutation(api.booking.book, {
      serviceId: input.serviceId as Id<'services'>,
      stylistId: input.stylistId as Id<'stylists'> | null,
      startsAt: Date.parse(input.startsAt),
      fullName: input.fullName,
      phone: input.phone,
      email: input.email ?? undefined,
      notes: input.notes || undefined,
      policyAccepted: input.policyAccepted,
    })
    booking = {
      appointmentId: row.appointmentId,
      reference: row.reference,
      status: row.status,
      stylistId: row.stylistId,
      startsAt: new Date(row.startsAt).toISOString(),
      endsAt: new Date(row.endsAt).toISOString(),
    }
  } catch (error) {
    return errorResponse(toAppError(error))
  }

  after(() => notifyAppointment(booking.appointmentId, booking.status === 'confirmed' ? 'confirmed' : 'requested'))

  const response = NextResponse.json(
    { booking: { reference: booking.reference, status: booking.status, startsAt: booking.startsAt, endsAt: booking.endsAt } },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  )
  response.cookies.set(BOOKING_COOKIE, sealBookingAccess(booking.reference, input.phone), bookingCookieOptions)
  return response
}
