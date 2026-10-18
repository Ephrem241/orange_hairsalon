/** Loads the schedule data the availability rules need, through indexes only. */
import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import type { Hours, Interval, StylistDay } from './availability'
import { DAY, localTs, MINUTE, weekdayOf, type IsoDate } from './time'
import { isLive } from './validators'

/** Longest possible service plus buffer, so overlapping appointments that started earlier are found. */
const MAX_BLOCK_MS = (600 + 120) * MINUTE
/** Generous caps: time off per stylist ending after an instant; appointments per stylist in a few days. */
const TIME_OFF_CAP = 500
const APPOINTMENT_CAP = 500

export type Schedule = {
  hours: Map<number, Hours>
  shifts: Doc<'workingHours'>[]
  breaks: Doc<'stylistBreaks'>[]
  timeOff: Interval[]
  busy: (Interval & { id: string })[]
}

export async function loadBusinessHours(ctx: QueryCtx): Promise<Map<number, Hours>> {
  // At most seven rows, one per weekday.
  const rows = await ctx.db.query('businessHours').withIndex('by_weekday').take(7)
  return new Map(rows.map((r) => [r.weekday, { isClosed: r.isClosed, opensAt: r.opensAt, closesAt: r.closesAt }]))
}

/** Time off that overlaps [from, to) for one stylist, or salon-wide closures when stylistId is undefined. */
export async function timeOffBetween(
  ctx: QueryCtx,
  stylistId: Id<'stylists'> | undefined,
  from: number,
  to: number,
): Promise<Doc<'timeOff'>[]> {
  const rows = await ctx.db
    .query('timeOff')
    .withIndex('by_stylistId_and_endsAt', (q) => q.eq('stylistId', stylistId).gt('endsAt', from))
    .take(TIME_OFF_CAP)
  return rows.filter((t) => t.startsAt < to)
}

/** Live appointments for a stylist that could overlap [from, to). */
export async function liveAppointmentsBetween(ctx: QueryCtx, stylistId: Id<'stylists'>, from: number, to: number) {
  const rows = await ctx.db
    .query('appointments')
    .withIndex('by_stylistId_and_startsAt', (q) => q.eq('stylistId', stylistId).gte('startsAt', from - MAX_BLOCK_MS).lt('startsAt', to))
    .take(APPOINTMENT_CAP)
  return rows.filter((a) => isLive(a.status) && a.blockedUntil > from)
}

/**
 * Everything needed to judge a stylist's availability on the salon dates
 * [fromDate, toDate]. Pass withAppointments: false for calendar views.
 */
export async function loadSchedule(
  ctx: QueryCtx,
  stylistId: Id<'stylists'>,
  fromDate: IsoDate,
  toDate: IsoDate,
  opts: { hours?: Map<number, Hours>; salonClosures?: Doc<'timeOff'>[]; withAppointments?: boolean } = {},
): Promise<Schedule> {
  const from = localTs(fromDate, '00:00')
  // A clean-up buffer can run past midnight, so look one day further.
  const to = localTs(toDate, '00:00') + 2 * DAY
  const [hours, shifts, breaks, own, salon, appointments] = await Promise.all([
    opts.hours ?? loadBusinessHours(ctx),
    ctx.db.query('workingHours').withIndex('by_stylistId_and_weekday', (q) => q.eq('stylistId', stylistId)).take(100),
    ctx.db.query('stylistBreaks').withIndex('by_stylistId_and_weekday', (q) => q.eq('stylistId', stylistId)).take(100),
    timeOffBetween(ctx, stylistId, from, to),
    opts.salonClosures ?? timeOffBetween(ctx, undefined, from, to),
    opts.withAppointments === false ? Promise.resolve([]) : liveAppointmentsBetween(ctx, stylistId, from, to),
  ])
  return {
    hours,
    shifts,
    breaks,
    timeOff: [...own, ...salon].map((t) => ({ start: t.startsAt, end: t.endsAt })),
    busy: appointments.map((a) => ({ start: a.startsAt, end: a.blockedUntil, id: a._id })),
  }
}

export function dayOf(schedule: Schedule, date: IsoDate): StylistDay {
  const weekday = weekdayOf(date)
  return {
    date,
    hours: schedule.hours.get(weekday) ?? null,
    shifts: schedule.shifts.filter((s) => s.weekday === weekday),
    breaks: schedule.breaks.filter((b) => b.weekday === weekday),
    timeOff: schedule.timeOff,
    busy: schedule.busy,
  }
}
