/** Salon settings. Admins only (the public site reads them through public.ts). */
import { v } from 'convex/values'
import type { QueryCtx } from './_generated/server'
import { ADMIN_ONLY, staffMutation, staffQuery } from './lib/access'
import { fail } from './lib/errors'
import { integer, optionalEmail, optionalHttps, optionalPhone, text, timeRange } from './lib/validate'
import { socialsValidator } from './lib/validators'
import schema from './schema'

export const get = staffQuery({
  roles: ADMIN_ONLY,
  args: {},
  returns: v.object({
    business: v.union(schema.doc('businessSettings'), v.null()),
    hours: v.array(schema.doc('businessHours')),
    notifications: v.union(schema.doc('notificationSettings'), v.null()),
  }),
  handler: async (ctx) => ({
    business: await ctx.db.query('businessSettings').first(),
    hours: await ctx.db.query('businessHours').withIndex('by_weekday').take(7),
    notifications: await ctx.db.query('notificationSettings').first(),
  }),
})

async function settingsDoc(ctx: QueryCtx) {
  return (await ctx.db.query('businessSettings').first()) ?? fail('NOT_CONFIGURED')
}

export const saveBusiness = staffMutation({
  roles: ADMIN_ONLY,
  args: {
    name: v.string(),
    tagline: v.string(),
    phone: v.string(),
    whatsapp: v.string(),
    email: v.string(),
    addressLine: v.string(),
    city: v.string(),
    mapUrl: v.string(),
    latitude: v.union(v.number(), v.null()),
    longitude: v.union(v.number(), v.null()),
    socials: socialsValidator,
    aboutStory: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const settings = await settingsDoc(ctx)
    if ((a.latitude === null) !== (a.longitude === null)) fail('INVALID_INPUT', 'latitude')
    if (a.latitude !== null && (!Number.isFinite(a.latitude) || Math.abs(a.latitude) > 90)) fail('INVALID_INPUT', 'latitude')
    if (a.longitude !== null && (!Number.isFinite(a.longitude) || Math.abs(a.longitude) > 180)) fail('INVALID_INPUT', 'longitude')
    const socials = Object.fromEntries(
      Object.entries(a.socials).flatMap(([key, url]) => {
        const checked = optionalHttps(`socials.${key}`, url)
        return checked ? [[key, checked]] : []
      }),
    )
    await ctx.db.patch('businessSettings', settings._id, {
      name: text('name', a.name, { max: 120, required: true }),
      tagline: text('tagline', a.tagline, { max: 200 }),
      phone: optionalPhone('phone', a.phone),
      whatsapp: optionalPhone('whatsapp', a.whatsapp),
      email: optionalEmail('email', a.email),
      addressLine: text('addressLine', a.addressLine, { max: 200 }),
      city: text('city', a.city, { max: 80, required: true }),
      mapUrl: optionalHttps('mapUrl', a.mapUrl),
      latitude: a.latitude ?? undefined,
      longitude: a.longitude ?? undefined,
      socials,
      aboutStory: text('aboutStory', a.aboutStory, { max: 6000 }),
      updatedAt: Date.now(),
    })
    return null
  },
})

export const savePolicy = staffMutation({
  roles: ADMIN_ONLY,
  args: {
    onlineBookingEnabled: v.boolean(),
    autoConfirm: v.boolean(),
    requireEmail: v.boolean(),
    allowCustomerCancel: v.boolean(),
    allowCustomerReschedule: v.boolean(),
    minLeadMinutes: v.number(),
    maxAdvanceDays: v.number(),
    slotIntervalMin: v.number(),
    defaultBufferMin: v.number(),
    cancelCutoffHours: v.number(),
    policyText: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const settings = await settingsDoc(ctx)
    if (![5, 10, 15, 20, 30, 60].includes(a.slotIntervalMin)) fail('INVALID_INPUT', 'slotIntervalMin')
    await ctx.db.patch('businessSettings', settings._id, {
      onlineBookingEnabled: a.onlineBookingEnabled,
      autoConfirm: a.autoConfirm,
      requireEmail: a.requireEmail,
      allowCustomerCancel: a.allowCustomerCancel,
      allowCustomerReschedule: a.allowCustomerReschedule,
      minLeadMinutes: integer('minLeadMinutes', a.minLeadMinutes, 0, 10080),
      maxAdvanceDays: integer('maxAdvanceDays', a.maxAdvanceDays, 1, 365),
      slotIntervalMin: a.slotIntervalMin,
      defaultBufferMin: integer('defaultBufferMin', a.defaultBufferMin, 0, 120),
      cancelCutoffHours: integer('cancelCutoffHours', a.cancelCutoffHours, 0, 336),
      policyText: text('policyText', a.policyText, { max: 6000 }),
      updatedAt: Date.now(),
    })
    return null
  },
})

export const saveHours = staffMutation({
  roles: ADMIN_ONLY,
  args: {
    days: v.array(v.object({ weekday: v.number(), isClosed: v.boolean(), opensAt: v.string(), closesAt: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, { days }) => {
    if (days.length !== 7 || new Set(days.map((d) => d.weekday)).size !== 7) fail('INVALID_INPUT', 'days')
    for (const d of days) {
      if (!Number.isInteger(d.weekday) || d.weekday < 0 || d.weekday > 6) fail('INVALID_INPUT', 'weekday')
      if (!d.isClosed) timeRange(d.opensAt, d.closesAt)
      const row = { weekday: d.weekday, isClosed: d.isClosed, opensAt: d.isClosed ? undefined : d.opensAt, closesAt: d.isClosed ? undefined : d.closesAt }
      const existing = await ctx.db
        .query('businessHours')
        .withIndex('by_weekday', (q) => q.eq('weekday', d.weekday))
        .first()
      if (existing) await ctx.db.replace('businessHours', existing._id, row)
      else await ctx.db.insert('businessHours', row)
    }
    return null
  },
})

export const saveNotifications = staffMutation({
  roles: ADMIN_ONLY,
  args: { emailEnabled: v.boolean(), whatsappEnabled: v.boolean(), remindersEnabled: v.boolean(), salonAlertEmail: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const row = {
      emailEnabled: a.emailEnabled,
      whatsappEnabled: a.whatsappEnabled,
      remindersEnabled: a.remindersEnabled,
      salonAlertEmail: optionalEmail('salonAlertEmail', a.salonAlertEmail),
      updatedAt: Date.now(),
    }
    const existing = await ctx.db.query('notificationSettings').first()
    if (existing) await ctx.db.patch('notificationSettings', existing._id, row)
    else await ctx.db.insert('notificationSettings', row)
    return null
  },
})
