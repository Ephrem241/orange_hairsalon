import { timingSafeEqual } from 'node:crypto'
import { api } from '@convex/_generated/api'
import { NextResponse } from 'next/server'
import { notifyAppointment } from '@/lib/notifications/notify'
import { isServerDataConfigured, serverQuery } from '@/lib/convex/server'
import { addDays, salonDate, salonInstant } from '@/lib/time'

export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(header)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/**
 * Daily (Vercel Cron, see vercel.json): remind clients of tomorrow's confirmed
 * appointments. Reminders are deduplicated per appointment time, so a retried
 * run never double-sends. (Old rate-limit rows are pruned by a Convex cron.)
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isServerDataConfigured) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const tomorrow = addDays(salonDate(), 1)
  let ids: string[]
  try {
    ids = await serverQuery(api.notifications.confirmedBetween, {
      from: Date.parse(salonInstant(tomorrow, '00:00')),
      to: Date.parse(salonInstant(addDays(tomorrow, 1), '00:00')),
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }

  const tally = { appointments: ids.length, sent: 0, failed: 0, skipped: 0, duplicate: 0 }
  for (const id of ids) {
    for (const outcome of await notifyAppointment(id, 'reminder')) tally[outcome.status === 'pending' ? 'failed' : outcome.status]++
  }
  return NextResponse.json({ date: tomorrow, ...tally })
}
