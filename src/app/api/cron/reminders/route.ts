import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { notifyAppointment } from '@/lib/notifications/notify'
import { createAdminClient, isServerDataConfigured } from '@/lib/supabase/admin'
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
 * appointments, then prune old rate-limit rows. Reminders are deduplicated per
 * appointment time, so a retried run never double-sends.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isServerDataConfigured) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const tomorrow = addDays(salonDate(), 1)
  const db = createAdminClient()
  const { data, error } = await db
    .from('appointments')
    .select('id')
    .eq('status', 'confirmed')
    .gte('starts_at', salonInstant(tomorrow, '00:00'))
    .lt('starts_at', salonInstant(addDays(tomorrow, 1), '00:00'))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tally = { appointments: data.length, sent: 0, failed: 0, skipped: 0, duplicate: 0 }
  for (const { id } of data) {
    for (const outcome of await notifyAppointment(id, 'reminder')) tally[outcome.status === 'pending' ? 'failed' : outcome.status]++
  }
  const { data: pruned } = await db.rpc('prune_rate_limits')
  return NextResponse.json({ date: tomorrow, ...tally, prunedRateLimits: pruned ?? 0 })
}
