/**
 * Dashboard appointment functions. Front desk (admin, receptionist) manages
 * the diary; a stylist reads only their own appointments.
 */
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { FRONT_DESK, isFrontDesk, staffMutation, staffQuery, type Staff } from './lib/access'
import { checkSlot, freeSlots } from './lib/availability'
import { bufferFor, createBooking, eligibleStylists, performsService, requireSettings } from './lib/engine'
import { fail } from './lib/errors'
import { derivedTimes } from './lib/records'
import { dayOf, loadSchedule } from './lib/schedule'
import { iso, isIsoDate, localDate } from './lib/time'
import { REFERENCE } from './lib/validate'
import { appointmentStatusValidator, isLive, type AppointmentStatus } from './lib/validators'
import schema from './schema'

const adminAppointment = v.object({ ...schema.doc('appointments').fields, stylistName: v.string() })

/** The stylist a caller is limited to, or null for front desk (everyone). */
function scopeFor(staff: Staff): Id<'stylists'> | null | 'none' {
  if (isFrontDesk(staff)) return null
  return staff.stylistId ?? 'none'
}

async function withStylistNames(ctx: QueryCtx, rows: Doc<'appointments'>[]) {
  const names = new Map<Id<'stylists'>, string>()
  for (const row of rows) {
    if (!names.has(row.stylistId)) names.set(row.stylistId, (await ctx.db.get('stylists', row.stylistId))?.displayName ?? '—')
  }
  return rows.map((row) => ({ ...row, stylistName: names.get(row.stylistId)! }))
}

export const list = staffQuery({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    status: v.optional(v.union(appointmentStatusValidator, v.literal('live'))),
    stylistId: v.optional(v.id('stylists')),
    serviceId: v.optional(v.id('services')),
    customerId: v.optional(v.id('customers')),
    q: v.optional(v.string()),
    limit: v.optional(v.number()),
    ascending: v.optional(v.boolean()),
  },
  returns: v.array(adminAppointment),
  handler: async (ctx, args) => {
    const scope = scopeFor(ctx.staff)
    if (scope === 'none') return []
    const stylistId = scope ?? args.stylistId
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 300), 1), 500)
    const order = args.ascending === false ? 'desc' : 'asc'

    const keep = (a: Doc<'appointments'>) =>
      (args.from === undefined || a.startsAt >= args.from) &&
      (args.to === undefined || a.startsAt < args.to) &&
      (args.status === undefined || (args.status === 'live' ? isLive(a.status) : a.status === args.status)) &&
      (stylistId === undefined || a.stylistId === stylistId) &&
      (args.serviceId === undefined || a.serviceId === args.serviceId) &&
      (args.customerId === undefined || a.customerId === args.customerId)

    const q = args.q?.trim()
    if (q) {
      const reference = q.toUpperCase().replace(/^OS(?!-)/, 'OS-')
      let rows: Doc<'appointments'>[]
      if (REFERENCE.test(reference)) {
        const one = await ctx.db
          .query('appointments')
          .withIndex('by_reference', (r) => r.eq('reference', reference))
          .unique()
        rows = one ? [one] : []
      } else {
        // Phone numbers are matched on their last nine digits (e.g. 0912… or +251912…).
        const digits = q.replace(/\D/g, '')
        const term = digits.length >= 4 ? digits.slice(-9) : q
        rows = await ctx.db
          .query('appointments')
          .withSearchIndex('search_text', (s) => {
            const search = s.search('searchText', term)
            return stylistId ? search.eq('stylistId', stylistId) : search
          })
          .take(500)
      }
      const matched = rows.filter(keep).sort((a, b) => (order === 'asc' ? a.startsAt - b.startsAt : b.startsAt - a.startsAt))
      return await withStylistNames(ctx, matched.slice(0, limit))
    }

    // Bounded on both sides; instants are always positive.
    const from = args.from ?? 0
    const to = args.to ?? Number.MAX_SAFE_INTEGER
    const base = ctx.db.query('appointments')
    const query = args.customerId
      ? base.withIndex('by_customerId_and_startsAt', (r) => r.eq('customerId', args.customerId!).gte('startsAt', from).lt('startsAt', to))
      : stylistId
        ? base.withIndex('by_stylistId_and_startsAt', (r) => r.eq('stylistId', stylistId).gte('startsAt', from).lt('startsAt', to))
        : args.status && args.status !== 'live'
          ? base.withIndex('by_status_and_startsAt', (r) => r.eq('status', args.status as AppointmentStatus).gte('startsAt', from).lt('startsAt', to))
          : base.withIndex('by_startsAt', (r) => r.gte('startsAt', from).lt('startsAt', to))

    const out: Doc<'appointments'>[] = []
    for await (const row of query.order(order)) {
      if (keep(row)) out.push(row)
      if (out.length >= limit) break
    }
    return await withStylistNames(ctx, out)
  },
})

export const get = staffQuery({
  args: { id: v.id('appointments') },
  returns: v.union(
    v.object({
      appointment: adminAppointment,
      events: v.array(schema.doc('appointmentEvents')),
      notifications: v.array(schema.doc('notificationLog')),
    }),
    v.null(),
  ),
  handler: async (ctx, { id }) => {
    const scope = scopeFor(ctx.staff)
    const appointment = await ctx.db.get('appointments', id)
    if (!appointment || scope === 'none' || (scope !== null && appointment.stylistId !== scope)) return null
    const [withName] = await withStylistNames(ctx, [appointment])
    const events = await ctx.db
      .query('appointmentEvents')
      .withIndex('by_appointmentId', (q) => q.eq('appointmentId', id))
      .take(200)
    const notifications = isFrontDesk(ctx.staff)
      ? await ctx.db
          .query('notificationLog')
          .withIndex('by_appointmentId', (q) => q.eq('appointmentId', id))
          .take(200)
      : []
    return { appointment: withName, events, notifications }
  },
})

/** Latest booking activity, newest first (a stylist sees only their own). */
export const recentEvents = staffQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      event: schema.doc('appointmentEvents'),
      appointment: v.object({ _id: v.id('appointments'), reference: v.string(), customerName: v.string(), serviceName: v.string() }),
    }),
  ),
  handler: async (ctx, args) => {
    const scope = scopeFor(ctx.staff)
    if (scope === 'none') return []
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 10), 1), 50)
    const out = []
    for await (const event of ctx.db.query('appointmentEvents').order('desc')) {
      const a = await ctx.db.get('appointments', event.appointmentId)
      if (a && (scope === null || a.stylistId === scope)) {
        out.push({ event, appointment: { _id: a._id, reference: a.reference, customerName: a.customerName, serviceName: a.serviceName } })
      }
      if (out.length >= limit) break
    }
    return out
  },
})

/**
 * Counts and revenue for a period. Recorded revenue counts completed
 * appointments only (amount paid, or the listed price); expected revenue is
 * confirmed work not yet completed.
 */
export const summary = staffQuery({
  args: { from: v.number(), to: v.number() },
  returns: v.object({
    total: v.number(),
    pending: v.number(),
    confirmed: v.number(),
    completed: v.number(),
    cancelled: v.number(),
    noShow: v.number(),
    recordedRevenueEtb: v.number(),
    expectedRevenueEtb: v.number(),
  }),
  handler: async (ctx, { from, to }) => {
    const scope = scopeFor(ctx.staff)
    const totals = { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0, recordedRevenueEtb: 0, expectedRevenueEtb: 0 }
    if (scope === 'none') return totals
    const rows =
      scope === null
        ? ctx.db.query('appointments').withIndex('by_startsAt', (q) => q.gte('startsAt', from).lt('startsAt', to))
        : ctx.db.query('appointments').withIndex('by_stylistId_and_startsAt', (q) => q.eq('stylistId', scope).gte('startsAt', from).lt('startsAt', to))
    for await (const a of rows) {
      totals.total++
      if (a.status === 'no_show') totals.noShow++
      else totals[a.status]++
      if (a.status === 'completed') totals.recordedRevenueEtb += a.amountPaidEtb ?? a.priceEtb
      if (a.status === 'confirmed') totals.expectedRevenueEtb += a.priceEtb
    }
    return totals
  },
})

/** Free times for a service on a date (optionally one stylist), ignoring an appointment being moved. */
export const staffSlots = staffQuery({
  roles: FRONT_DESK,
  args: {
    serviceId: v.id('services'),
    stylistId: v.union(v.id('stylists'), v.null()),
    date: v.string(),
    ignoreId: v.optional(v.id('appointments')),
    /** Slots before this instant are left out (queries must not read the clock). */
    now: v.number(),
  },
  returns: v.array(v.object({ startsAt: v.number(), stylistId: v.id('stylists') })),
  handler: async (ctx, args) => {
    if (!isIsoDate(args.date)) fail('INVALID_INPUT', 'date')
    const settings = await requireSettings(ctx)
    const service = (await ctx.db.get('services', args.serviceId)) ?? fail('SERVICE_UNAVAILABLE')
    // When rescheduling, keep the appointment's own snapshot of duration/buffer.
    const moving = args.ignoreId ? await ctx.db.get('appointments', args.ignoreId) : null
    const duration = moving?.durationMin ?? service.durationMin
    const buffer = moving?.bufferMin ?? bufferFor(service, settings)
    const out: { startsAt: number; stylistId: Id<'stylists'> }[] = []
    for (const stylist of await eligibleStylists(ctx, service._id, { online: false, stylistId: args.stylistId })) {
      const day = dayOf(await loadSchedule(ctx, stylist._id, args.date, args.date), args.date)
      for (const slot of freeSlots(day, duration, buffer, settings.slotIntervalMin, args.ignoreId)) {
        if (slot >= args.now) out.push({ startsAt: slot, stylistId: stylist._id })
      }
    }
    // Stylists are already in display order; a stable sort keeps it within each time.
    return out.sort((a, b) => a.startsAt - b.startsAt)
  },
})

export const create = staffMutation({
  roles: FRONT_DESK,
  args: {
    serviceId: v.id('services'),
    stylistId: v.union(v.id('stylists'), v.null()),
    startsAt: v.number(),
    fullName: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    source: v.union(v.literal('phone'), v.literal('walk_in')),
    confirm: v.boolean(),
  },
  returns: v.object({ appointmentId: v.id('appointments'), reference: v.string(), status: appointmentStatusValidator }),
  handler: async (ctx, args) => {
    const result = await createBooking(ctx, { ...args, staffMode: true, actorId: ctx.staff.userId, policyAccepted: false })
    return { appointmentId: result.appointmentId, reference: result.reference, status: result.status }
  },
})

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
}

export const setStatus = staffMutation({
  roles: FRONT_DESK,
  args: {
    id: v.id('appointments'),
    status: v.union(v.literal('confirmed'), v.literal('cancelled'), v.literal('completed'), v.literal('no_show')),
    reason: v.optional(v.string()),
    amountPaidEtb: v.optional(v.number()),
  },
  returns: v.object({ status: appointmentStatusValidator, event: v.string() }),
  handler: async (ctx, { id, status, reason, amountPaidEtb }) => {
    const now = Date.now()
    const a = (await ctx.db.get('appointments', id)) ?? fail('NOT_FOUND')
    if (!TRANSITIONS[a.status].includes(status)) fail('INVALID_TRANSITION', `${a.status} → ${status}`)
    const why = reason?.trim() || undefined

    if (status === 'confirmed') {
      // The schedule may have changed since the request (time off, new hours).
      const date = localDate(a.startsAt)
      const day = dayOf(await loadSchedule(ctx, a.stylistId, date, date), date)
      const problem = checkSlot(day, a.startsAt, a.durationMin, a.bufferMin, a._id)
      if (problem) fail('SLOT_NO_LONGER_AVAILABLE', problem)
    } else if (status === 'cancelled' && !why) {
      fail('REASON_REQUIRED')
    } else if ((status === 'completed' || status === 'no_show') && a.startsAt > now) {
      fail('NOT_STARTED')
    }
    if (amountPaidEtb !== undefined && (status !== 'completed' || !Number.isInteger(amountPaidEtb) || amountPaidEtb < 0 || amountPaidEtb > 1_000_000)) {
      fail('INVALID_AMOUNT')
    }

    await ctx.db.patch('appointments', id, {
      status,
      ...(status === 'confirmed' ? { confirmedAt: now } : {}),
      ...(status === 'cancelled' ? { cancelledAt: now, cancelledBy: 'staff' as const, cancelReason: why?.slice(0, 500) } : {}),
      ...(status === 'completed' ? { completedAt: now, amountPaidEtb } : {}),
      updatedAt: now,
    })
    const event = status === 'cancelled' && a.status === 'pending' ? 'rejected' : status
    await ctx.db.insert('appointmentEvents', {
      appointmentId: id,
      event,
      actorType: 'staff',
      actorId: ctx.staff.userId,
      details: { from: a.status, to: status, reason: why, amountPaidEtb },
    })
    return { status, event }
  },
})

export const reschedule = staffMutation({
  roles: FRONT_DESK,
  args: { id: v.id('appointments'), startsAt: v.number(), stylistId: v.union(v.id('stylists'), v.null()) },
  returns: v.null(),
  handler: async (ctx, { id, startsAt, stylistId }) => {
    const a = (await ctx.db.get('appointments', id)) ?? fail('NOT_FOUND')
    if (!isLive(a.status)) fail('INVALID_TRANSITION')
    const target = stylistId ?? a.stylistId
    const stylist = await ctx.db.get('stylists', target)
    if (!stylist?.isActive || !(await performsService(ctx, target, a.serviceId))) fail('STYLIST_UNAVAILABLE')

    const date = localDate(startsAt)
    const day = dayOf(await loadSchedule(ctx, target, date, date), date)
    const problem = checkSlot(day, startsAt, a.durationMin, a.bufferMin, a._id)
    if (problem) fail('SLOT_UNAVAILABLE', problem)

    await ctx.db.patch('appointments', id, {
      startsAt,
      stylistId: target,
      ...derivedTimes(startsAt, a.durationMin, a.bufferMin),
      updatedAt: Date.now(),
    })
    await ctx.db.insert('appointmentEvents', {
      appointmentId: id,
      event: 'rescheduled',
      actorType: 'staff',
      actorId: ctx.staff.userId,
      details: { from: iso(a.startsAt), to: iso(startsAt), fromStylistId: a.stylistId, toStylistId: target },
    })
    return null
  },
})

export const updateNotes = staffMutation({
  roles: FRONT_DESK,
  args: { id: v.id('appointments'), notes: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, notes }) => {
    if (!(await ctx.db.get('appointments', id))) fail('NOT_FOUND')
    await ctx.db.patch('appointments', id, { internalNotes: notes.trim().slice(0, 2000) || undefined, updatedAt: Date.now() })
    return null
  },
})
