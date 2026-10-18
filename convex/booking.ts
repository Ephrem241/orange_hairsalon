/**
 * Public booking API and customer self-service. Callable only by the Next.js
 * server (serverSecret), which validates input, rate-limits and holds the
 * encrypted "this browser may manage booking X" cookie.
 *
 * Customer self-service is keyed on reference + the phone number used to book.
 * Queries take the current time as `now` (queries must not read the clock).
 */
import { v } from 'convex/values'
import type { QueryCtx } from './_generated/server'
import { serverMutation, serverQuery } from './lib/access'
import {
  availableSlots,
  bookableDays,
  createBooking,
  customerView,
  findCustomerBooking,
  requireSettings,
  stylistFreeSlots,
} from './lib/engine'
import { fail } from './lib/errors'
import { derivedTimes } from './lib/records'
import { addDays, HOUR, iso, isIsoDate, localDate, MINUTE } from './lib/time'
import { appointmentStatusValidator, isLive, priceTypeValidator } from './lib/validators'

const isoDate = (value: string) => (isIsoDate(value) ? value : fail('INVALID_INPUT', 'date'))

const customerViewValidator = v.object({
  reference: v.string(),
  status: appointmentStatusValidator,
  serviceId: v.id('services'),
  serviceName: v.string(),
  stylistName: v.union(v.string(), v.null()),
  startsAt: v.number(),
  endsAt: v.number(),
  durationMin: v.number(),
  priceEtb: v.number(),
  priceType: priceTypeValidator,
  customerName: v.string(),
  canCancel: v.boolean(),
  canReschedule: v.boolean(),
  changeDeadline: v.number(),
})

export const availability = serverQuery({
  args: { serviceId: v.id('services'), stylistId: v.union(v.id('stylists'), v.null()), date: v.string(), now: v.number() },
  returns: v.array(v.object({ slotStart: v.number(), stylistsFree: v.number() })),
  handler: async (ctx, args) => await availableSlots(ctx, { ...args, date: isoDate(args.date) }),
})

export const bookableDaysInRange = serverQuery({
  args: { serviceId: v.id('services'), stylistId: v.union(v.id('stylists'), v.null()), from: v.string(), to: v.string(), now: v.number() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => await bookableDays(ctx, { ...args, from: isoDate(args.from), to: isoDate(args.to) }),
})

export const book = serverMutation({
  args: {
    serviceId: v.id('services'),
    stylistId: v.union(v.id('stylists'), v.null()),
    startsAt: v.number(),
    fullName: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    policyAccepted: v.boolean(),
  },
  returns: v.object({
    appointmentId: v.id('appointments'),
    reference: v.string(),
    status: appointmentStatusValidator,
    stylistId: v.id('stylists'),
    startsAt: v.number(),
    endsAt: v.number(),
  }),
  handler: async (ctx, args) =>
    await createBooking(ctx, { ...args, source: 'online', staffMode: false, confirm: false }),
})

export const lookup = serverQuery({
  args: { reference: v.string(), phone: v.string(), now: v.number() },
  returns: v.union(v.object({ appointmentId: v.id('appointments'), booking: customerViewValidator }), v.null()),
  handler: async (ctx, { reference, phone, now }) => {
    const a = await findCustomerBooking(ctx, reference, phone)
    if (!a) return null
    return { appointmentId: a._id, booking: await customerView(ctx, a, await requireSettings(ctx), now) }
  },
})

export const cancel = serverMutation({
  args: { reference: v.string(), phone: v.string(), reason: v.optional(v.string()) },
  returns: v.object({ appointmentId: v.id('appointments'), booking: customerViewValidator }),
  handler: async (ctx, { reference, phone, reason }) => {
    const now = Date.now()
    const settings = await requireSettings(ctx)
    const a = (await findCustomerBooking(ctx, reference, phone)) ?? fail('NOT_FOUND')
    if (!isLive(a.status)) fail('INVALID_TRANSITION')
    if (!settings.allowCustomerCancel) fail('CHANGES_NOT_ALLOWED')
    if (now > a.startsAt - settings.cancelCutoffHours * HOUR) fail('PAST_CUTOFF')

    const cancelReason = reason?.trim().slice(0, 500) || undefined
    await ctx.db.patch('appointments', a._id, {
      status: 'cancelled',
      cancelledAt: now,
      cancelledBy: 'customer',
      cancelReason,
      updatedAt: now,
    })
    await ctx.db.insert('appointmentEvents', {
      appointmentId: a._id,
      event: 'cancelled',
      actorType: 'customer',
      details: { reason: cancelReason },
    })
    const updated = (await ctx.db.get('appointments', a._id))!
    return { appointmentId: a._id, booking: await customerView(ctx, updated, settings, now) }
  },
})

/** Times this booking can move to: same stylist and service, ignoring the booking itself. */
export const rescheduleSlots = serverQuery({
  args: { reference: v.string(), phone: v.string(), date: v.string(), now: v.number() },
  returns: v.array(v.number()),
  handler: async (ctx, { reference, phone, date, now }) => await rescheduleOptions(ctx, reference, phone, isoDate(date), now),
})

async function rescheduleOptions(
  ctx: QueryCtx,
  reference: string,
  phone: string,
  date: string,
  now: number,
): Promise<number[]> {
  const settings = await requireSettings(ctx)
  const a = await findCustomerBooking(ctx, reference, phone)
  if (!a || !isLive(a.status) || !settings.allowCustomerReschedule) return []
  const today = localDate(now)
  if (date < today || date > addDays(today, settings.maxAdvanceDays)) return []
  const stylist = await ctx.db.get('stylists', a.stylistId)
  if (!stylist?.isActive) return []
  const earliest = now + settings.minLeadMinutes * MINUTE
  const slots = await stylistFreeSlots(ctx, a.stylistId, date, a.durationMin, a.bufferMin, settings.slotIntervalMin, a._id)
  return slots.filter((s) => s >= earliest)
}

export const reschedule = serverMutation({
  args: { reference: v.string(), phone: v.string(), startsAt: v.number() },
  returns: v.object({ appointmentId: v.id('appointments'), booking: customerViewValidator }),
  handler: async (ctx, { reference, phone, startsAt }) => {
    const now = Date.now()
    const settings = await requireSettings(ctx)
    const a = (await findCustomerBooking(ctx, reference, phone)) ?? fail('NOT_FOUND')
    if (!isLive(a.status)) fail('INVALID_TRANSITION')
    if (!settings.allowCustomerReschedule) fail('CHANGES_NOT_ALLOWED')
    if (now > a.startsAt - settings.cancelCutoffHours * HOUR) fail('PAST_CUTOFF')
    const options = await rescheduleOptions(ctx, reference, phone, localDate(startsAt), now)
    if (!options.includes(startsAt)) fail('SLOT_UNAVAILABLE')

    const status = settings.autoConfirm ? 'confirmed' : 'pending'
    await ctx.db.patch('appointments', a._id, {
      startsAt,
      ...derivedTimes(startsAt, a.durationMin, a.bufferMin),
      status,
      confirmedAt: status === 'confirmed' ? now : undefined,
      updatedAt: now,
    })
    await ctx.db.insert('appointmentEvents', {
      appointmentId: a._id,
      event: 'rescheduled',
      actorType: 'customer',
      details: { from: iso(a.startsAt), to: iso(startsAt) },
    })
    const updated = (await ctx.db.get('appointments', a._id))!
    return { appointmentId: a._id, booking: await customerView(ctx, updated, settings, now) }
  },
})
