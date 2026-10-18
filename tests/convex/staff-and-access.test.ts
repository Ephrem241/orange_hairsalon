// @vitest-environment edge-runtime
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { beforeAll, describe, expect, it } from 'vitest'
import { at, createSalon, customer, errorOf, localTime, nextWeekday, SECRET, type Salon } from './fixtures'

let s: Salon
const day = nextWeekday(2, 3) // a Tuesday

beforeAll(async () => {
  s = await createSalon()
})

const bookOnline = (stylistId: Id<'stylists'>, time: string, phone: string) => s.book({ stylistId, startsAt: at(day, time), phone })

describe('front desk workflow', () => {
  it('books a phone appointment at any free time, already confirmed', async () => {
    const r = await s.desk.mutation(api.appointments.create, {
      serviceId: s.ids.silkPress,
      stylistId: s.ids.ama,
      startsAt: at(day, '08:10'),
      fullName: 'Selam K',
      phone: '+251911400400',
      notes: 'Called in',
      source: 'phone',
      confirm: true,
    })
    expect(r.status).toBe('confirmed')
    const detail = await s.desk.query(api.appointments.get, { id: r.appointmentId })
    expect(localTime(detail!.appointment.startsAt)).toBe('08:10')
  })

  it('cannot confirm a request whose slot has been lost to time off', async () => {
    const { appointmentId } = await bookOnline(s.ids.ama, '13:00', '+251911400401')
    await s.desk.mutation(api.stylists.addTimeOff, { stylistId: s.ids.ama, startsAt: at(day, '13:00'), endsAt: at(day, '14:00'), reason: 'Doctor' })
    expect(await errorOf(s.desk.mutation(api.appointments.setStatus, { id: appointmentId, status: 'confirmed' }))).toBe('SLOT_NO_LONGER_AVAILABLE')

    const [doctor] = await s.desk.query(api.stylists.upcomingTimeOff, { from: at(day, '00:00'), scope: s.ids.ama })
    await s.desk.mutation(api.stylists.removeTimeOff, { id: doctor._id })
    expect(await s.desk.mutation(api.appointments.setStatus, { id: appointmentId, status: 'confirmed' })).toEqual({ status: 'confirmed', event: 'confirmed' })
  })

  it('reports how many bookings clash with new time off', async () => {
    await bookOnline(s.ids.bethel, '18:00', '+251911400409')
    const { clashes } = await s.desk.mutation(api.stylists.addTimeOff, { stylistId: s.ids.bethel, startsAt: at(day, '17:30'), endsAt: at(day, '19:00'), reason: 'Training' })
    expect(clashes).toBe(1)
  })

  it('enforces the status lifecycle', async () => {
    const { appointmentId: id } = await bookOnline(s.ids.bethel, '10:00', '+251911400402')
    expect(await errorOf(s.desk.mutation(api.appointments.setStatus, { id, status: 'completed' }))).toBe('INVALID_TRANSITION')
    expect(await errorOf(s.desk.mutation(api.appointments.setStatus, { id, status: 'cancelled' }))).toBe('REASON_REQUIRED')
    expect(await s.desk.mutation(api.appointments.setStatus, { id, status: 'cancelled', reason: 'Client asked by phone' })).toMatchObject({ event: 'rejected' })
    expect(await errorOf(s.desk.mutation(api.appointments.setStatus, { id, status: 'confirmed' }))).toBe('INVALID_TRANSITION')
  })

  it('cannot mark an appointment completed before it starts', async () => {
    const { appointmentId: id } = await bookOnline(s.ids.bethel, '12:00', '+251911400403')
    await s.desk.mutation(api.appointments.setStatus, { id, status: 'confirmed' })
    expect(await errorOf(s.desk.mutation(api.appointments.setStatus, { id, status: 'completed' }))).toBe('NOT_STARTED')
  })

  it('reschedules only into genuinely free time, optionally to another stylist', async () => {
    const { appointmentId: id } = await bookOnline(s.ids.ama, '15:00', '+251911400404')
    const reschedule = (time: string, stylistId: Id<'stylists'> | null = null) =>
      s.desk.mutation(api.appointments.reschedule, { id, startsAt: at(day, time), stylistId })

    expect(await errorOf(reschedule('08:30'))).toBe('SLOT_UNAVAILABLE') // overlaps the 08:10 phone booking
    await reschedule('16:00', s.ids.bethel)
    const detail = await s.desk.query(api.appointments.get, { id })
    expect(detail!.appointment.stylistId).toBe(s.ids.bethel)
    expect(localTime(detail!.appointment.startsAt)).toBe('16:00')
    expect(detail!.events.map((e) => e.event)).toEqual(['created', 'rescheduled'])
  })

  it('lists staff slots for any stylist', async () => {
    const slots = await s.desk.query(api.appointments.staffSlots, { serviceId: s.ids.silkPress, stylistId: null, date: day, now: Date.now() })
    expect(slots.length).toBeGreaterThan(0)
    expect(new Set(slots.map((x) => x.stylistId))).toEqual(new Set([s.ids.ama, s.ids.bethel]))
  })
})

describe('revenue reporting', () => {
  it('counts recorded revenue from completed appointments only', async () => {
    const twoHoursAgo = Date.now() - 2 * 3_600_000
    const fiveHoursAgo = Date.now() - 5 * 3_600_000
    const paidLess = await s.insertAppointment({ stylistId: s.ids.bethel, startsAt: twoHoursAgo, priceEtb: 1500 })
    const noShow = await s.insertAppointment({ stylistId: s.ids.ama, startsAt: twoHoursAgo, priceEtb: 1500 })
    const listed = await s.insertAppointment({ stylistId: s.ids.ama, startsAt: fiveHoursAgo, priceEtb: 2000 })

    await s.desk.mutation(api.appointments.setStatus, { id: paidLess, status: 'completed', amountPaidEtb: 1200 })
    await s.desk.mutation(api.appointments.setStatus, { id: noShow, status: 'no_show' })
    await s.desk.mutation(api.appointments.setStatus, { id: listed, status: 'completed' }) // no amount entered → listed price

    const summary = await s.owner.query(api.appointments.summary, { from: Date.now() - 24 * 3_600_000, to: Date.now() - 60_000 })
    expect(summary).toMatchObject({ completed: 2, noShow: 1, recordedRevenueEtb: 3200, expectedRevenueEtb: 0 })
  })

  it('reports expected revenue from confirmed, not-yet-completed work', async () => {
    const from = at(day, '00:00')
    const to = at(day, '23:59')
    const expected = await s.t.run(async (ctx) => {
      const rows = await ctx.db.query('appointments').withIndex('by_startsAt', (q) => q.gte('startsAt', from).lt('startsAt', to)).collect()
      return rows.filter((a) => a.status === 'confirmed').reduce((sum, a) => sum + a.priceEtb, 0)
    })
    const summary = await s.owner.query(api.appointments.summary, { from, to })
    expect(summary.expectedRevenueEtb).toBe(expected)
    expect(summary.expectedRevenueEtb).toBeGreaterThan(0)
    expect(summary.recordedRevenueEtb).toBe(0)
  })
})

describe('access control', () => {
  it('hides appointments, customers and stylist contacts from the public', async () => {
    expect(await errorOf(s.t.query(api.appointments.list, {}))).toBe('FORBIDDEN')
    expect(await errorOf(s.t.query(api.customers.list, {}))).toBe('FORBIDDEN')
    expect(await errorOf(s.t.query(api.stylists.detail, { id: s.ids.ama }))).toBe('FORBIDDEN')
  })

  it('keeps the public booking functions behind the server secret', async () => {
    const args = { serviceId: s.ids.silkPress, stylistId: null, startsAt: at(day, '17:00'), fullName: 'X Y', phone: '+251911000000', policyAccepted: true }
    expect(await errorOf(s.t.mutation(api.booking.book, { ...args, serverSecret: 'wrong-secret-wrong-secret' }))).toBe('FORBIDDEN')
    expect(await errorOf(s.stranger.mutation(api.booking.book, { ...args, serverSecret: '' }))).toBe('FORBIDDEN')
    expect(await errorOf(s.t.query(api.booking.lookup, { serverSecret: 'nope', reference: 'OS-ABCDEF', phone: '+251911000000', now: Date.now() }))).toBe('FORBIDDEN')
    expect(await errorOf(s.t.mutation(api.rateLimit.consume, { serverSecret: 'nope', key: 'k', limit: 1, windowSeconds: 60 }))).toBe('FORBIDDEN')
  })

  it('shows the public only active services and published content', async () => {
    const services = await s.t.query(api.public.services, {})
    expect(services.map((x) => x.slug).sort()).toEqual(['knotless-braids', 'silk-press'])
    await s.t.run((ctx) => ctx.db.insert('reviews', { authorName: 'Draft', body: 'Unverified', source: 'other', isPublished: false, sortOrder: 0, updatedAt: Date.now() }))
    expect(await s.t.query(api.public.reviews, {})).toEqual([])
    // Private contact details are never part of the public stylist view.
    expect(JSON.stringify(await s.t.query(api.public.stylists, {}))).not.toContain('+251911000001')
  })

  it('gives signed-in non-staff users nothing beyond the public view', async () => {
    expect(await s.stranger.query(api.staff.me, {})).toBeNull()
    expect(await errorOf(s.stranger.query(api.appointments.list, {}))).toBe('FORBIDDEN')
    expect(await errorOf(s.stranger.query(api.customers.list, {}))).toBe('FORBIDDEN')
    expect(await errorOf(s.stranger.query(api.appointments.staffSlots, { serviceId: s.ids.silkPress, stylistId: null, date: day, now: Date.now() }))).toBe('FORBIDDEN')
  })

  it('limits stylists to their own diary, read-only', async () => {
    const mine = await s.stylist.query(api.appointments.list, {})
    expect(mine.length).toBeGreaterThan(0)
    expect(new Set(mine.map((a) => a.stylistId))).toEqual(new Set([s.ids.ama]))
    // Filters can't widen the view.
    expect(await s.stylist.query(api.appointments.list, { stylistId: s.ids.bethel })).toEqual(mine)
    expect(await errorOf(s.stylist.query(api.customers.list, {}))).toBe('FORBIDDEN')
    expect(await errorOf(s.stylist.mutation(api.appointments.setStatus, { id: mine[0]._id, status: 'cancelled', reason: 'nope' }))).toBe('FORBIDDEN')

    const bethels = await s.desk.query(api.appointments.list, { stylistId: s.ids.bethel })
    expect(await s.stylist.query(api.appointments.get, { id: bethels[0]._id })).toBeNull()
    expect(await s.stylist.query(api.stylists.detail, { id: s.ids.bethel })).toBeNull()
    expect(await s.stylist.query(api.stylists.detail, { id: s.ids.ama })).not.toBeNull()
  })

  it('lets only admins change business settings and the catalogue', async () => {
    const business = { name: 'Orange Salon', tagline: 'changed', phone: '+251912419748', whatsapp: '', email: '', addressLine: 'Ednamoll Street', city: 'Addis Ababa', mapUrl: '', latitude: null, longitude: null, socials: {}, aboutStory: '' }
    expect(await errorOf(s.desk.mutation(api.settings.saveBusiness, business))).toBe('FORBIDDEN')
    await s.owner.mutation(api.settings.saveBusiness, business)
    expect((await s.t.query(api.public.settings, {}))?.tagline).toBe('changed')

    const service = { id: s.ids.silkPress, name: 'Silk press', slug: 'silk-press', categoryId: null, summary: '', description: '', imagePath: null, priceEtb: 1500, priceType: 'fixed' as const, durationMin: 60, bufferMin: 15, isActive: true, isFeatured: false, sortOrder: 0 }
    expect(await errorOf(s.desk.mutation(api.catalog.saveService, { ...service, priceEtb: 1 }))).toBe('FORBIDDEN')
    expect(await errorOf(s.owner.mutation(api.catalog.saveService, { ...service, priceEtb: -5 }))).toBe('INVALID_INPUT')
    expect(await errorOf(s.owner.mutation(api.catalog.saveService, { ...service, durationMin: 0 }))).toBe('INVALID_INPUT')
    expect(await errorOf(s.owner.mutation(api.catalog.saveService, { ...service, id: null, slug: 'knotless-braids' }))).toBe('SLUG_TAKEN')
  })

  it('records an audit trail of admin changes', async () => {
    const events = await s.owner.query(api.audit.list, {})
    expect(events).toContainEqual(expect.objectContaining({ actorId: s.ids.admin, entity: 'businessSettings', action: 'update', actorName: 'Owner' }))
    expect(await errorOf(s.desk.query(api.audit.list, {}))).toBe('FORBIDDEN')
  })

  it('never removes the last active admin', async () => {
    const demote = { id: s.ids.adminProfile, fullName: 'Owner', role: 'receptionist' as const, stylistId: null, isActive: true }
    expect(await errorOf(s.owner.mutation(api.staff.update, demote))).toBe('LAST_ADMIN')
    expect(await errorOf(s.owner.mutation(api.staff.update, { ...demote, role: 'admin', isActive: false }))).toBe('LAST_ADMIN')

    // With a second admin the first can step down.
    await s.t.run((ctx) =>
      ctx.db.insert('staffProfiles', { userId: s.ids.admin2, fullName: 'Co-owner', email: 'owner2@example.com', role: 'admin', isActive: true, updatedAt: Date.now() }),
    )
    await s.owner.mutation(api.staff.update, demote)
    expect((await s.owner.query(api.staff.me, {}))?.role).toBe('receptionist')
  })

  it('requires stylist logins to point at one stylist profile', async () => {
    const coOwner = s.as(s.ids.admin2)
    const desk = (await coOwner.query(api.staff.list, {})).find((p) => p.email === 'desk@example.com')!
    const update = { id: desk._id, fullName: 'Front desk', role: 'stylist' as const, isActive: true }
    expect(await errorOf(coOwner.mutation(api.staff.update, { ...update, stylistId: null }))).toBe('STYLIST_LINK_REQUIRED')
    expect(await errorOf(coOwner.mutation(api.staff.update, { ...update, stylistId: s.ids.ama }))).toBe('STYLIST_ALREADY_LINKED')
  })

  it('stops staff from rewriting a customer’s phone number', async () => {
    const [c] = await s.desk.query(api.customers.list, { q: customer.name.split(' ')[0] })
    await s.desk.mutation(api.customers.update, { id: c._id, fullName: 'Hana T.', email: '', staffNotes: 'Prefers mornings' })
    const after = await s.desk.query(api.customers.get, { id: c._id })
    expect(after).toMatchObject({ fullName: 'Hana T.', phoneE164: c.phoneE164, staffNotes: 'Prefers mornings' })
  })

  it('finds clients and appointments by name, phone or reference', async () => {
    expect((await s.desk.query(api.customers.list, { q: '0911 400 402' })).map((c) => c.phoneE164)).toEqual(['+251911400402'])
    const [first] = await s.desk.query(api.appointments.list, {})
    const byRef = await s.desk.query(api.appointments.list, { q: first.reference.replace('OS-', 'os') })
    expect(byRef.map((a) => a._id)).toEqual([first._id])
    expect((await s.desk.query(api.appointments.list, { q: 'Selam' })).every((a) => a.customerName === 'Selam K')).toBe(true)
  })

  it('rate-limits with a fixed window', async () => {
    const hit = () => s.t.mutation(api.rateLimit.consume, { serverSecret: SECRET, key: 'test:key', limit: 2, windowSeconds: 60 })
    expect([await hit(), await hit(), await hit()]).toEqual([true, true, false])
  })
})

describe('atomic admin helpers', () => {
  it('replaces a weekly schedule and rejects overlapping or inverted shifts', async () => {
    const coOwner = s.as(s.ids.admin2)
    const set = (hours: { weekday: number; startsAt: string; endsAt: string }[]) =>
      coOwner.mutation(api.stylists.setSchedule, { stylistId: s.ids.bethel, hours, breaks: [] })

    expect(await errorOf(set([{ weekday: 1, startsAt: '09:00', endsAt: '13:00' }, { weekday: 1, startsAt: '12:00', endsAt: '18:00' }]))).toBe('SCHEDULE_OVERLAP')
    expect(await errorOf(set([{ weekday: 1, startsAt: '18:00', endsAt: '09:00' }]))).toBe('INVALID_SCHEDULE')

    await set([{ weekday: 1, startsAt: '09:00', endsAt: '13:00' }, { weekday: 1, startsAt: '14:00', endsAt: '18:00' }])
    expect((await coOwner.query(api.stylists.detail, { id: s.ids.bethel }))!.hours).toHaveLength(2)
    expect(await errorOf(s.desk.mutation(api.stylists.setSchedule, { stylistId: s.ids.bethel, hours: [], breaks: [] }))).toBe('FORBIDDEN')
  })

  it('reorders the gallery', async () => {
    const coOwner = s.as(s.ids.admin2)
    const items = await coOwner.query(api.content.listGallery, {})
    const reversed = items.map((i) => i._id).reverse()
    await coOwner.mutation(api.content.reorderGallery, { ids: reversed })
    expect((await coOwner.query(api.content.listGallery, {})).map((i) => i._id)).toEqual(reversed)
  })
})
