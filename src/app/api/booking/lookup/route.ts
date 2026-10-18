import { NextResponse } from 'next/server'
import { errorResponse, readJson, validationResponse } from '@/lib/api'
import { BOOKING_COOKIE, bookingCookieOptions, sealBookingAccess } from '@/lib/booking/access'
import { appError, toAppError } from '@/lib/booking/errors'
import { lookupBooking } from '@/lib/booking/server'
import { allowRequest, clientIp } from '@/lib/security/rate-limit'
import { isServerDataConfigured } from '@/lib/convex/server'
import { fieldErrors, lookupSchema } from '@/lib/validation'

/**
 * POST /api/booking/lookup — prove ownership of a booking with its reference
 * and the phone number used to book. Success sets the encrypted access cookie;
 * failure is deliberately vague and rate-limited per IP and per reference.
 */
export async function POST(request: Request) {
  if (!isServerDataConfigured) return errorResponse(appError('NOT_CONFIGURED'))
  const parsed = lookupSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationResponse(fieldErrors(parsed.error))
  const { reference, phone } = parsed.data

  const [ipOk, refOk] = await Promise.all([
    allowRequest('lookup:ip', clientIp(request.headers), 10, 900),
    allowRequest('lookup:ref', reference, 6, 900),
  ])
  if (!ipOk || !refOk) return errorResponse(appError('RATE_LIMITED'))

  let booking
  try {
    booking = await lookupBooking(reference, phone)
  } catch (error) {
    return errorResponse(toAppError(error))
  }
  if (!booking) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'We couldn’t find a booking with that reference and phone number.' } },
      { status: 404 },
    )
  }

  const response = NextResponse.json({ reference: booking.reference }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(BOOKING_COOKIE, sealBookingAccess(booking.reference, phone), bookingCookieOptions)
  return response
}
