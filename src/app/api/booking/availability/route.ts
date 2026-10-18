import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, validationResponse } from '@/lib/api'
import { appError, toAppError } from '@/lib/booking/errors'
import { allowRequest, clientIp } from '@/lib/security/rate-limit'
import { isServerDataConfigured, serverQuery } from '@/lib/convex/server'
import { addDays, isIsoDate } from '@/lib/time'
import { convexId } from '@/lib/validation'

const query = z.object({
  service: convexId(),
  stylist: z.union([convexId(), z.literal('any')]).default('any'),
  date: z.string().refine(isIsoDate).optional(),
  from: z.string().refine(isIsoDate).optional(),
  to: z.string().refine(isIsoDate).optional(),
})

/**
 * GET ?service&stylist&date        → bookable start times for that day
 * GET ?service&stylist&from&to     → dates that have any availability (calendar)
 * Times are ISO-8601 UTC; the client renders them in Africa/Addis_Ababa.
 */
export async function GET(request: NextRequest) {
  if (!isServerDataConfigured) return errorResponse(appError('NOT_CONFIGURED'))
  if (!(await allowRequest('availability', clientIp(request.headers), 120, 60))) return errorResponse(appError('RATE_LIMITED'))

  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return validationResponse({ query: 'Invalid availability request.' })
  const { service, date, from, to } = parsed.data
  const serviceId = service as Id<'services'>
  const stylistId = parsed.data.stylist === 'any' ? null : (parsed.data.stylist as Id<'stylists'>)
  const headers = { 'Cache-Control': 'no-store' }

  try {
    if (date) {
      const slots = await serverQuery(api.booking.availability, { serviceId, stylistId, date, now: Date.now() })
      return NextResponse.json(
        { date, slots: slots.map((s) => ({ startsAt: new Date(s.slotStart).toISOString(), stylistsFree: s.stylistsFree })) },
        { headers },
      )
    }
    if (from && to) {
      if (to < from || to > addDays(from, 62)) return validationResponse({ query: 'Date range too large.' })
      const days = await serverQuery(api.booking.bookableDaysInRange, { serviceId, stylistId, from, to, now: Date.now() })
      return NextResponse.json({ days }, { headers })
    }
  } catch (error) {
    return errorResponse(toAppError(error))
  }

  return validationResponse({ query: 'Provide a date, or a from/to range.' })
}
