/**
 * The booking engine. Convex is the single authority on availability:
 *
 *   createBooking — validates, assigns a stylist and inserts, in one mutation.
 *   availableSlots / bookableDays — what the website offers.
 *
 * Mutations are serializable transactions. createBooking reads the stylist's
 * appointments around the requested time before inserting, so if two requests
 * race for the same slot Convex re-runs the later one, which then sees the
 * first booking and fails with SLOT_TAKEN. That replaces the old EXCLUDE
 * constraint as the double-booking guarantee.
 */
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { checkSlot, dayIsOpen, freeSlots } from './availability'
import { fail } from './errors'
import { appointmentSearchText, customerSearchText, derivedTimes, newReference } from './records'
import { dayOf, liveAppointmentsBetween, loadBusinessHours, loadSchedule, timeOffBetween } from './schedule'
import { addDays, DAY, HOUR, localDate, localTs, MINUTE, type IsoDate } from './time'
import { EMAIL, PHONE_E164 } from './validate'
import { isLive, type AppointmentStatus, type BookingSource } from './validators'

export async function getSettings(ctx: QueryCtx): Promise<Doc<'businessSettings'> | null> {
  return await ctx.db.query('businessSettings').first()
}

export async function requireSettings(ctx: QueryCtx): Promise<Doc<'businessSettings'>> {
  return (await getSettings(ctx)) ?? fail('NOT_CONFIGURED')
}

export const bufferFor = (service: Doc<'services'>, settings: Doc<'businessSettings'>) =>
  service.bufferMin ?? settings.defaultBufferMin

/** Active stylists who perform the service, ordered for display. */
export async function eligibleStylists(
  ctx: QueryCtx,
  serviceId: Id<'services'>,
  opts: { online: boolean; stylistId?: Id<'stylists'> | null },
): Promise<Doc<'stylists'>[]> {
  const links = await ctx.db
    .query('stylistServices')
    .withIndex('by_serviceId', (q) => q.eq('serviceId', serviceId))
    .take(200)
  const stylists = await Promise.all(links.map((l) => ctx.db.get('stylists', l.stylistId)))
  return stylists
    .filter((s): s is Doc<'stylists'> => s !== null)
    .filter((s) => s.isActive && (!opts.online || s.acceptsOnlineBooking) && (!opts.stylistId || s._id === opts.stylistId))
    .sort((a, b) => a.sortOrder - b.sortOrder || a._id.localeCompare(b._id))
}

export async function performsService(ctx: QueryCtx, stylistId: Id<'stylists'>, serviceId: Id<'services'>) {
  const link = await ctx.db
    .query('stylistServices')
    .withIndex('by_stylistId_and_serviceId', (q) => q.eq('stylistId', stylistId).eq('serviceId', serviceId))
    .first()
  return link !== null
}

/** Free start times on a salon date for one stylist (no lead-time filter). */
export async function stylistFreeSlots(
  ctx: QueryCtx,
  stylistId: Id<'stylists'>,
  date: IsoDate,
  durationMin: number,
  bufferMin: number,
  intervalMin: number,
  ignoreAppointmentId?: Id<'appointments'>,
): Promise<number[]> {
  const schedule = await loadSchedule(ctx, stylistId, date, date)
  return freeSlots(dayOf(schedule, date), durationMin, bufferMin, intervalMin, ignoreAppointmentId)
}

/** Online availability for a service on one date: each start and how many stylists are free. */
export async function availableSlots(
  ctx: QueryCtx,
  args: { serviceId: Id<'services'>; stylistId: Id<'stylists'> | null; date: IsoDate; now: number },
): Promise<{ slotStart: number; stylistsFree: number }[]> {
  const settings = await getSettings(ctx)
  if (!settings || !settings.onlineBookingEnabled) return []
  const service = await ctx.db.get('services', args.serviceId)
  if (!service || !service.isActive) fail('SERVICE_UNAVAILABLE')
  const today = localDate(args.now)
  if (args.date < today || args.date > addDays(today, settings.maxAdvanceDays)) return []

  const dayStart = localTs(args.date, '00:00')
  const [hours, salonClosures, stylists] = await Promise.all([
    loadBusinessHours(ctx),
    timeOffBetween(ctx, undefined, dayStart, dayStart + 2 * DAY),
    eligibleStylists(ctx, service._id, { online: true, stylistId: args.stylistId }),
  ])
  const earliest = args.now + settings.minLeadMinutes * MINUTE
  const counts = new Map<number, number>()
  for (const stylist of stylists) {
    const schedule = await loadSchedule(ctx, stylist._id, args.date, args.date, { hours, salonClosures })
    const day = dayOf(schedule, args.date)
    for (const slot of freeSlots(day, service.durationMin, bufferFor(service, settings), settings.slotIntervalMin)) {
      if (slot >= earliest) counts.set(slot, (counts.get(slot) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort(([a], [b]) => a - b).map(([slotStart, stylistsFree]) => ({ slotStart, stylistsFree }))
}

/**
 * Dates in [from, to] on which at least one eligible stylist is scheduled and
 * not fully away. Used to grey out the calendar; exact slots come per day.
 */
export async function bookableDays(
  ctx: QueryCtx,
  args: { serviceId: Id<'services'>; stylistId: Id<'stylists'> | null; from: IsoDate; to: IsoDate; now: number },
): Promise<IsoDate[]> {
  const settings = await getSettings(ctx)
  if (!settings || !settings.onlineBookingEnabled) return []
  const service = await ctx.db.get('services', args.serviceId)
  if (!service || !service.isActive) return []

  const today = localDate(args.now)
  const first = args.from > today ? args.from : today
  const last = [args.to, addDays(today, settings.maxAdvanceDays), addDays(args.from, 62)].sort()[0]
  if (first > last) return []

  const from = localTs(first, '00:00')
  const to = localTs(last, '00:00') + 2 * DAY
  const [hours, salonClosures, stylists] = await Promise.all([
    loadBusinessHours(ctx),
    timeOffBetween(ctx, undefined, from, to),
    eligibleStylists(ctx, service._id, { online: true, stylistId: args.stylistId }),
  ])
  const schedules = await Promise.all(
    stylists.map((s) => loadSchedule(ctx, s._id, first, last, { hours, salonClosures, withAppointments: false })),
  )
  const days: IsoDate[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) {
    if (schedules.some((schedule) => dayIsOpen(dayOf(schedule, d)))) days.push(d)
  }
  return days
}

export type BookingInput = {
  serviceId: Id<'services'>
  stylistId: Id<'stylists'> | null
  startsAt: number
  fullName: string
  phone: string
  email?: string
  notes?: string
  source: BookingSource
  /** Front desk: any free time (not only grid slots), no online-only rules. */
  staffMode: boolean
  actorId?: Id<'users'>
  confirm: boolean
  policyAccepted: boolean
}

export type BookingResult = {
  appointmentId: Id<'appointments'>
  reference: string
  status: AppointmentStatus
  stylistId: Id<'stylists'>
  startsAt: number
  endsAt: number
}

/** Shared by online booking and front-desk entry. */
export async function createBooking(ctx: MutationCtx, input: BookingInput): Promise<BookingResult> {
  const now = Date.now()
  const settings = await requireSettings(ctx)
  const name = input.fullName.trim()
  const email = input.email?.trim().toLowerCase() || undefined
  const notes = input.notes?.trim() || undefined
  const date = localDate(input.startsAt)

  if (name.length < 2 || name.length > 120) fail('INVALID_NAME')
  if (!PHONE_E164.test(input.phone)) fail('INVALID_PHONE')
  if (email !== undefined && !EMAIL.test(email)) fail('INVALID_EMAIL')
  if (notes !== undefined && notes.length > 1000) fail('NOTES_TOO_LONG')
  if (!Number.isFinite(input.startsAt)) fail('INVALID_TIME')

  const service = await ctx.db.get('services', input.serviceId)
  if (!service || !service.isActive) fail('SERVICE_UNAVAILABLE')
  const buffer = bufferFor(service, settings)

  if (input.staffMode) {
    if (input.startsAt < now - 12 * HOUR) fail('IN_PAST')
  } else {
    if (!settings.onlineBookingEnabled) fail('BOOKING_DISABLED')
    if (!input.policyAccepted) fail('POLICY_NOT_ACCEPTED')
    if (settings.requireEmail && email === undefined) fail('EMAIL_REQUIRED')
    if (input.startsAt < now + settings.minLeadMinutes * MINUTE) fail('TOO_SOON')
    if (date > addDays(localDate(now), settings.maxAdvanceDays)) fail('TOO_FAR')
  }

  // Find or create the customer. A public booking never overwrites the details
  // already on file for a phone number.
  const existing = await ctx.db
    .query('customers')
    .withIndex('by_phoneE164', (q) => q.eq('phoneE164', input.phone))
    .unique()
  const customerId =
    existing?._id ??
    (await ctx.db.insert('customers', {
      fullName: name,
      phoneE164: input.phone,
      email,
      isDemo: false,
      searchText: customerSearchText(name, input.phone, email),
      updatedAt: now,
    }))

  const status: AppointmentStatus = input.confirm || (!input.staffMode && settings.autoConfirm) ? 'confirmed' : 'pending'

  // Candidates: the chosen stylist, or every eligible stylist ordered by how
  // busy they already are that day ("any available stylist").
  const dayStart = localTs(date, '00:00')
  const stylists = await eligibleStylists(ctx, service._id, { online: !input.staffMode, stylistId: input.stylistId })
  const load = await Promise.all(
    stylists.map(async (s) => {
      const appointments = await liveAppointmentsBetween(ctx, s._id, dayStart, dayStart + DAY)
      return appointments.filter((a) => a.startsAt >= dayStart && a.startsAt < dayStart + DAY).length
    }),
  )
  const candidates = stylists
    .map((stylist, i) => ({ stylist, load: load[i] }))
    .sort((a, b) => a.load - b.load || a.stylist.sortOrder - b.stylist.sortOrder || a.stylist._id.localeCompare(b.stylist._id))

  let lastReason: string | null = null
  for (const { stylist } of candidates) {
    const day = dayOf(await loadSchedule(ctx, stylist._id, date, date), date)
    let reason: string | null
    if (input.staffMode) {
      reason = checkSlot(day, input.startsAt, service.durationMin, buffer)
    } else if (freeSlots(day, service.durationMin, buffer, settings.slotIntervalMin).includes(input.startsAt)) {
      reason = null
    } else {
      reason = checkSlot(day, input.startsAt, service.durationMin, buffer) ?? 'OFF_GRID'
    }
    if (reason !== null) {
      lastReason = reason
      continue
    }

    const reference = await newReference(ctx)
    const times = derivedTimes(input.startsAt, service.durationMin, buffer)
    const appointmentId = await ctx.db.insert('appointments', {
      reference,
      serviceId: service._id,
      stylistId: stylist._id,
      customerId,
      status,
      source: input.source,
      startsAt: input.startsAt,
      ...times,
      serviceName: service.name,
      priceEtb: service.priceEtb,
      priceType: service.priceType,
      durationMin: service.durationMin,
      bufferMin: buffer,
      customerName: name,
      customerPhone: input.phone,
      customerEmail: email,
      customerNotes: notes,
      policyAcceptedAt: input.policyAccepted ? now : undefined,
      confirmedAt: status === 'confirmed' ? now : undefined,
      createdBy: input.actorId,
      isDemo: false,
      searchText: appointmentSearchText(name, input.phone, reference),
      updatedAt: now,
    })
    await ctx.db.insert('appointmentEvents', {
      appointmentId,
      event: 'created',
      actorType: input.staffMode ? 'staff' : 'customer',
      actorId: input.actorId,
      details: { source: input.source, status },
    })
    return { appointmentId, reference, status, stylistId: stylist._id, startsAt: input.startsAt, endsAt: times.endsAt }
  }

  if (candidates.length === 0) fail('STYLIST_UNAVAILABLE')
  if (lastReason === 'OVERLAP') fail('SLOT_TAKEN')
  return fail('SLOT_UNAVAILABLE', lastReason ?? undefined)
}

/** The customer-facing view of an appointment (no internal notes or contact data). */
export async function customerView(ctx: QueryCtx, a: Doc<'appointments'>, settings: Doc<'businessSettings'>, now: number) {
  const stylist = await ctx.db.get('stylists', a.stylistId)
  const deadline = a.startsAt - settings.cancelCutoffHours * HOUR
  const open = isLive(a.status) && now <= deadline
  return {
    reference: a.reference,
    status: a.status,
    serviceId: a.serviceId,
    serviceName: a.serviceName,
    stylistName: stylist?.displayName ?? null,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    durationMin: a.durationMin,
    priceEtb: a.priceEtb,
    priceType: a.priceType,
    customerName: a.customerName,
    canCancel: open && settings.allowCustomerCancel,
    canReschedule: open && settings.allowCustomerReschedule,
    changeDeadline: deadline,
  }
}

/** Look up a booking by reference + the phone number used to book it. */
export async function findCustomerBooking(ctx: QueryCtx, reference: string, phone: string) {
  const a = await ctx.db
    .query('appointments')
    .withIndex('by_reference', (q) => q.eq('reference', reference.trim().toUpperCase()))
    .unique()
  return a && a.customerPhone === phone ? a : null
}
