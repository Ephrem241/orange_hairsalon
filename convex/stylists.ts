/**
 * Stylists, their weekly schedules and time off. Staff can see the team;
 * contacts and schedules are visible to front desk and to the stylist
 * themselves; admins edit profiles and schedules; front desk manages time off.
 */
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { ADMIN_ONLY, FRONT_DESK, isFrontDesk, staffMutation, staffQuery, type Staff } from './lib/access'
import { fail } from './lib/errors'
import { checkMediaPath, resolveMedia } from './lib/media'
import { liveAppointmentsBetween, timeOffBetween } from './lib/schedule'
import { assertSlugFree } from './lib/slugs'
import { integer, optionalEmail, optionalPhone, slug as checkSlug, text, timeRange } from './lib/validate'
import { isLive } from './lib/validators'
import schema from './schema'

const stylistWithServices = v.object({ ...schema.doc('stylists').fields, photoUrl: v.optional(v.string()), serviceIds: v.array(v.id('services')) })

async function serviceIdsOf(ctx: QueryCtx, stylistId: Id<'stylists'>) {
  const links = await ctx.db
    .query('stylistServices')
    .withIndex('by_stylistId_and_serviceId', (q) => q.eq('stylistId', stylistId))
    .take(500)
  return links.map((l) => l.serviceId)
}

const canSeeSchedule = (staff: Staff, stylistId: Id<'stylists'>) => isFrontDesk(staff) || staff.stylistId === stylistId

/** The whole team, active or not, ordered for display. */
export const list = staffQuery({
  args: {},
  returns: v.array(stylistWithServices),
  handler: async (ctx) => {
    const rows = await ctx.db.query('stylists').withIndex('by_sortOrder').take(200)
    rows.sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName))
    return await Promise.all(
      rows.map(async (s) => ({ ...s, photoUrl: await resolveMedia(ctx, s.photoPath), serviceIds: await serviceIdsOf(ctx, s._id) })),
    )
  },
})

/** Private contact details, weekly hours and breaks for one stylist. */
export const detail = staffQuery({
  args: { id: v.id('stylists') },
  returns: v.union(
    v.object({
      contact: v.union(v.object({ phone: v.optional(v.string()), email: v.optional(v.string()) }), v.null()),
      hours: v.array(schema.doc('workingHours')),
      breaks: v.array(schema.doc('stylistBreaks')),
    }),
    v.null(),
  ),
  handler: async (ctx, { id }) => {
    if (!canSeeSchedule(ctx.staff, id) || !(await ctx.db.get('stylists', id))) return null
    const [contact, hours, breaks] = await Promise.all([
      ctx.db.query('stylistContacts').withIndex('by_stylistId', (q) => q.eq('stylistId', id)).unique(),
      ctx.db.query('workingHours').withIndex('by_stylistId_and_weekday', (q) => q.eq('stylistId', id)).take(100),
      ctx.db.query('stylistBreaks').withIndex('by_stylistId_and_weekday', (q) => q.eq('stylistId', id)).take(100),
    ])
    const byTime = <T extends { weekday: number; startsAt: string }>(a: T, b: T) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt)
    return {
      contact: contact ? { phone: contact.phone, email: contact.email } : null,
      hours: hours.sort(byTime),
      breaks: breaks.sort(byTime),
    }
  },
})

export const save = staffMutation({
  roles: ADMIN_ONLY,
  args: {
    id: v.union(v.id('stylists'), v.null()),
    slug: v.optional(v.string()),
    displayName: v.string(),
    title: v.string(),
    bio: v.string(),
    photoPath: v.union(v.string(), v.null()),
    isActive: v.boolean(),
    acceptsOnlineBooking: v.boolean(),
    sortOrder: v.number(),
    phone: v.string(),
    email: v.string(),
  },
  returns: v.id('stylists'),
  handler: async (ctx, a) => {
    const now = Date.now()
    const row = {
      displayName: text('displayName', a.displayName, { max: 80, required: true }),
      title: text('title', a.title, { max: 80 }),
      bio: text('bio', a.bio, { max: 2000 }),
      photoPath: a.photoPath ? await checkMediaPath(ctx, 'photoPath', a.photoPath) : undefined,
      isActive: a.isActive,
      acceptsOnlineBooking: a.acceptsOnlineBooking,
      sortOrder: integer('sortOrder', a.sortOrder, 0, 10_000),
      updatedAt: now,
    }
    let id = a.id
    if (id) {
      if (!(await ctx.db.get('stylists', id))) fail('NOT_FOUND')
      await ctx.db.patch('stylists', id, row)
    } else {
      const slug = checkSlug('slug', a.slug ?? '')
      await assertSlugFree(ctx, 'stylists', slug, null)
      id = await ctx.db.insert('stylists', { ...row, slug, isDemo: false })
    }

    const contact = { phone: optionalPhone('phone', a.phone), email: optionalEmail('email', a.email), updatedAt: now }
    const existing = await ctx.db
      .query('stylistContacts')
      .withIndex('by_stylistId', (q) => q.eq('stylistId', id))
      .unique()
    if (existing) await ctx.db.patch('stylistContacts', existing._id, contact)
    else await ctx.db.insert('stylistContacts', { stylistId: id, ...contact })
    return id
  },
})

export const setServices = staffMutation({
  roles: ADMIN_ONLY,
  args: { stylistId: v.id('stylists'), serviceIds: v.array(v.id('services')) },
  returns: v.null(),
  handler: async (ctx, { stylistId, serviceIds }) => {
    if (!(await ctx.db.get('stylists', stylistId))) fail('NOT_FOUND')
    const wanted = new Set(serviceIds)
    const links = await ctx.db
      .query('stylistServices')
      .withIndex('by_stylistId_and_serviceId', (q) => q.eq('stylistId', stylistId))
      .take(500)
    for (const link of links) {
      if (!wanted.delete(link.serviceId)) await ctx.db.delete('stylistServices', link._id)
    }
    for (const serviceId of wanted) {
      if (!(await ctx.db.get('services', serviceId))) fail('INVALID_INPUT', 'serviceIds')
      await ctx.db.insert('stylistServices', { stylistId, serviceId })
    }
    return null
  },
})

const periodValidator = v.object({ weekday: v.number(), startsAt: v.string(), endsAt: v.string(), label: v.optional(v.string()) })

/** Periods on the same weekday may not overlap. */
function assertNoOverlap(periods: { weekday: number; startsAt: string; endsAt: string }[]) {
  const sorted = [...periods].sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt))
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].weekday === sorted[i - 1].weekday && sorted[i].startsAt < sorted[i - 1].endsAt) fail('SCHEDULE_OVERLAP')
  }
}

/** Replace a stylist's weekly hours and breaks in one transaction. */
export const setSchedule = staffMutation({
  roles: ADMIN_ONLY,
  args: { stylistId: v.id('stylists'), hours: v.array(periodValidator), breaks: v.array(periodValidator) },
  returns: v.null(),
  handler: async (ctx, { stylistId, hours, breaks }) => {
    if (!(await ctx.db.get('stylists', stylistId))) fail('NOT_FOUND')
    if (hours.length > 50 || breaks.length > 50) fail('INVALID_SCHEDULE')
    for (const p of [...hours, ...breaks]) {
      if (!Number.isInteger(p.weekday) || p.weekday < 0 || p.weekday > 6) fail('INVALID_SCHEDULE')
      timeRange(p.startsAt, p.endsAt)
    }
    assertNoOverlap(hours)
    assertNoOverlap(breaks)

    const [oldHours, oldBreaks] = await Promise.all([
      ctx.db.query('workingHours').withIndex('by_stylistId_and_weekday', (q) => q.eq('stylistId', stylistId)).take(100),
      ctx.db.query('stylistBreaks').withIndex('by_stylistId_and_weekday', (q) => q.eq('stylistId', stylistId)).take(100),
    ])
    for (const h of oldHours) await ctx.db.delete('workingHours', h._id)
    for (const b of oldBreaks) await ctx.db.delete('stylistBreaks', b._id)
    for (const h of hours) await ctx.db.insert('workingHours', { stylistId, weekday: h.weekday, startsAt: h.startsAt, endsAt: h.endsAt })
    for (const b of breaks) {
      await ctx.db.insert('stylistBreaks', {
        stylistId,
        weekday: b.weekday,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        label: text('label', b.label, { max: 60 }),
      })
    }
    await ctx.db.insert('auditEvents', {
      actorId: ctx.staff.userId,
      actorRole: ctx.staff.role,
      action: 'update',
      entity: 'stylistSchedule',
      entityId: stylistId,
      after: { hours, breaks },
    })
    return null
  },
})

/** Time off visible to the caller: front desk sees all; a stylist their own plus salon closures. */
function visibleTimeOff(staff: Staff, row: Doc<'timeOff'>) {
  return isFrontDesk(staff) || row.stylistId === undefined || row.stylistId === staff.stylistId
}

/**
 * Time off ending after `from`, soonest first. `scope` narrows it to one
 * stylist or to salon-wide closures; omit it for everything visible.
 */
export const upcomingTimeOff = staffQuery({
  args: { from: v.number(), scope: v.optional(v.union(v.id('stylists'), v.literal('salon'))) },
  returns: v.array(schema.doc('timeOff')),
  handler: async (ctx, { from, scope }) => {
    const far = from + 5 * 365 * 24 * 60 * 60 * 1000
    let rows: Doc<'timeOff'>[]
    if (scope === 'salon') rows = await timeOffBetween(ctx, undefined, from, far)
    else if (scope) rows = await timeOffBetween(ctx, scope, from, far)
    else {
      const stylists = await ctx.db.query('stylists').withIndex('by_sortOrder').take(200)
      const lists = await Promise.all([undefined, ...stylists.map((s) => s._id)].map((id) => timeOffBetween(ctx, id, from, far)))
      rows = lists.flat()
    }
    return rows.filter((r) => visibleTimeOff(ctx.staff, r)).sort((a, b) => a.startsAt - b.startsAt)
  },
})

/** Time off overlapping [from, to) for the day view. */
export const timeOffInRange = staffQuery({
  args: { from: v.number(), to: v.number() },
  returns: v.array(schema.doc('timeOff')),
  handler: async (ctx, { from, to }) => {
    const stylists = await ctx.db.query('stylists').withIndex('by_sortOrder').take(200)
    const lists = await Promise.all([undefined, ...stylists.map((s) => s._id)].map((id) => timeOffBetween(ctx, id, from, to)))
    return lists.flat().filter((r) => visibleTimeOff(ctx.staff, r))
  },
})

/**
 * Time off for one stylist (front desk), or a salon-wide closure (admins).
 * Existing bookings are kept; the result says how many now clash so staff can
 * contact those clients.
 */
export const addTimeOff = staffMutation({
  roles: FRONT_DESK,
  args: { stylistId: v.union(v.id('stylists'), v.null()), startsAt: v.number(), endsAt: v.number(), reason: v.string() },
  returns: v.object({ clashes: v.number() }),
  handler: async (ctx, a) => {
    if (a.stylistId === null && ctx.staff.role !== 'admin') fail('FORBIDDEN')
    if (a.stylistId && !(await ctx.db.get('stylists', a.stylistId))) fail('NOT_FOUND')
    if (!(a.endsAt > a.startsAt)) fail('INVALID_INPUT', 'endsAt')
    await ctx.db.insert('timeOff', {
      stylistId: a.stylistId ?? undefined,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      reason: text('reason', a.reason, { max: 200 }),
      createdBy: ctx.staff.userId,
    })

    const overlapping = (rows: Doc<'appointments'>[]) => rows.filter((x) => x.startsAt < a.endsAt && x.blockedUntil > a.startsAt).length
    if (a.stylistId) return { clashes: overlapping(await liveAppointmentsBetween(ctx, a.stylistId, a.startsAt, a.endsAt)) }
    let clashes = 0
    for await (const x of ctx.db
      .query('appointments')
      .withIndex('by_startsAt', (q) => q.gte('startsAt', a.startsAt - 12 * 60 * 60 * 1000).lt('startsAt', a.endsAt))) {
      if (isLive(x.status) && x.blockedUntil > a.startsAt) clashes++
    }
    return { clashes }
  },
})

export const removeTimeOff = staffMutation({
  roles: FRONT_DESK,
  args: { id: v.id('timeOff') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const row = (await ctx.db.get('timeOff', id)) ?? fail('NOT_FOUND')
    if (row.stylistId === undefined && ctx.staff.role !== 'admin') fail('FORBIDDEN')
    await ctx.db.delete('timeOff', id)
    return null
  },
})
