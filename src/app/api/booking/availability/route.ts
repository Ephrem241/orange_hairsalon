import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, validationResponse } from '@/lib/api'
import { appError, toAppError } from '@/lib/booking/errors'
import { allowRequest, clientIp } from '@/lib/security/rate-limit'
import { createAdminClient, isServerDataConfigured } from '@/lib/supabase/admin'
import { addDays, isIsoDate } from '@/lib/time'

const query = z.object({
  service: z.uuid(),
  stylist: z.union([z.uuid(), z.literal('any')]).default('any'),
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
  const stylist = parsed.data.stylist === 'any' ? null : parsed.data.stylist
  const db = createAdminClient()
  const headers = { 'Cache-Control': 'no-store' }

  if (date) {
    const { data, error } = await db.rpc('get_available_slots', { p_service_id: service, p_stylist_id: stylist, p_date: date })
    if (error) return errorResponse(toAppError(error))
    const slots = (data as { slot_start: string; stylists_free: number }[]).map((s) => ({
      startsAt: new Date(s.slot_start).toISOString(),
      stylistsFree: s.stylists_free,
    }))
    return NextResponse.json({ date, slots }, { headers })
  }

  if (from && to) {
    if (to < from || to > addDays(from, 62)) return validationResponse({ query: 'Date range too large.' })
    const { data, error } = await db.rpc('get_bookable_days', { p_service_id: service, p_stylist_id: stylist, p_from: from, p_to: to })
    if (error) return errorResponse(toAppError(error))
    return NextResponse.json({ days: (data as string[]).map((d) => String(d).slice(0, 10)) }, { headers })
  }

  return validationResponse({ query: 'Provide a date, or a from/to range.' })
}
