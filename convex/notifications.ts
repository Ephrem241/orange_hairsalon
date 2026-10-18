/**
 * Notification bookkeeping. Messages are sent by the Next.js server (Resend,
 * WhatsApp Cloud API); these functions keep the log, deduplicate and supply
 * the appointment details templates need. Front desk can read the log.
 */
import { v } from 'convex/values'
import { FRONT_DESK, serverMutation, serverQuery, staffQuery } from './lib/access'
import { fail } from './lib/errors'
import { notificationChannelValidator, notificationEventValidator, notificationStatusValidator, priceTypeValidator } from './lib/validators'
import schema from './schema'

/** Returns the new log id, or null when this dedupe key was already used (already sent). */
export const logCreate = serverMutation({
  args: {
    appointmentId: v.union(v.id('appointments'), v.null()),
    event: notificationEventValidator,
    channel: notificationChannelValidator,
    recipient: v.string(),
    dedupeKey: v.union(v.string(), v.null()),
    status: notificationStatusValidator,
    provider: v.union(v.string(), v.null()),
  },
  returns: v.union(v.id('notificationLog'), v.null()),
  handler: async (ctx, a) => {
    if (a.dedupeKey !== null) {
      const existing = await ctx.db
        .query('notificationLog')
        .withIndex('by_dedupeKey', (q) => q.eq('dedupeKey', a.dedupeKey!))
        .first()
      if (existing) return null
    }
    return await ctx.db.insert('notificationLog', {
      appointmentId: a.appointmentId ?? undefined,
      event: a.event,
      channel: a.channel,
      recipient: a.recipient,
      status: a.status,
      provider: a.provider ?? undefined,
      dedupeKey: a.dedupeKey ?? undefined,
      attempts: 0,
      updatedAt: Date.now(),
    })
  },
})

export const logUpdate = serverMutation({
  args: {
    id: v.id('notificationLog'),
    status: notificationStatusValidator,
    providerMessageId: v.optional(v.union(v.string(), v.null())),
    error: v.optional(v.union(v.string(), v.null())),
    incrementAttempts: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const row = (await ctx.db.get('notificationLog', a.id)) ?? fail('NOT_FOUND')
    const now = Date.now()
    await ctx.db.patch('notificationLog', a.id, {
      status: a.status,
      ...(a.providerMessageId !== undefined ? { providerMessageId: a.providerMessageId ?? undefined } : {}),
      ...(a.error !== undefined ? { error: a.error?.slice(0, 1000) ?? undefined } : {}),
      ...(a.incrementAttempts ? { attempts: row.attempts + 1 } : {}),
      ...(a.status === 'sent' ? { sentAt: now } : {}),
      updatedAt: now,
    })
    return null
  },
})

export const logEntry = serverQuery({
  args: { id: v.id('notificationLog') },
  returns: v.union(schema.doc('notificationLog'), v.null()),
  handler: async (ctx, { id }) => await ctx.db.get('notificationLog', id),
})

/** Everything the message templates need for one appointment. */
export const context = serverQuery({
  args: { appointmentId: v.id('appointments') },
  returns: v.union(
    v.object({
      appointment: v.object({
        id: v.id('appointments'),
        reference: v.string(),
        serviceName: v.string(),
        stylistName: v.union(v.string(), v.null()),
        startsAt: v.number(),
        customerName: v.string(),
        priceEtb: v.number(),
        priceType: priceTypeValidator,
        cancelReason: v.union(v.string(), v.null()),
        email: v.union(v.string(), v.null()),
        phone: v.string(),
      }),
      salon: v.object({ name: v.string(), phone: v.union(v.string(), v.null()), addressLine: v.union(v.string(), v.null()), city: v.string() }),
      prefs: v.object({ emailEnabled: v.boolean(), whatsappEnabled: v.boolean(), salonAlertEmail: v.union(v.string(), v.null()), remindersEnabled: v.boolean() }),
    }),
    v.null(),
  ),
  handler: async (ctx, { appointmentId }) => {
    const [a, s, n] = await Promise.all([
      ctx.db.get('appointments', appointmentId),
      ctx.db.query('businessSettings').first(),
      ctx.db.query('notificationSettings').first(),
    ])
    if (!a || !s) return null
    const stylist = await ctx.db.get('stylists', a.stylistId)
    return {
      appointment: {
        id: a._id,
        reference: a.reference,
        serviceName: a.serviceName,
        stylistName: stylist?.displayName ?? null,
        startsAt: a.startsAt,
        customerName: a.customerName,
        priceEtb: a.priceEtb,
        priceType: a.priceType,
        cancelReason: a.cancelReason ?? null,
        email: a.customerEmail ?? null,
        phone: a.customerPhone,
      },
      salon: { name: s.name, phone: s.phone ?? null, addressLine: s.addressLine ?? null, city: s.city },
      prefs: {
        emailEnabled: n?.emailEnabled ?? true,
        whatsappEnabled: n?.whatsappEnabled ?? false,
        salonAlertEmail: n?.salonAlertEmail ?? null,
        remindersEnabled: n?.remindersEnabled ?? true,
      },
    }
  },
})

/** Confirmed appointments starting in [from, to), for the daily reminder run. */
export const confirmedBetween = serverQuery({
  args: { from: v.number(), to: v.number() },
  returns: v.array(v.id('appointments')),
  handler: async (ctx, { from, to }) => {
    const rows = await ctx.db
      .query('appointments')
      .withIndex('by_status_and_startsAt', (q) => q.eq('status', 'confirmed').gte('startsAt', from).lt('startsAt', to))
      .take(2000)
    return rows.map((a) => a._id)
  },
})

export const list = staffQuery({
  roles: FRONT_DESK,
  args: { status: v.optional(notificationStatusValidator) },
  returns: v.array(v.object({ ...schema.doc('notificationLog').fields, reference: v.union(v.string(), v.null()) })),
  handler: async (ctx, { status }) => {
    const rows = status
      ? await ctx.db.query('notificationLog').withIndex('by_status', (q) => q.eq('status', status)).order('desc').take(200)
      : await ctx.db.query('notificationLog').order('desc').take(200)
    return await Promise.all(
      rows.map(async (n) => ({
        ...n,
        reference: n.appointmentId ? ((await ctx.db.get('appointments', n.appointmentId))?.reference ?? null) : null,
      })),
    )
  },
})
