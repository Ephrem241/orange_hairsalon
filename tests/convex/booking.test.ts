// @vitest-environment edge-runtime
import { api } from '@convex/_generated/api'
import { beforeAll, describe, expect, it } from 'vitest'
import { addDays, addisToday, at, createSalon, customer, errorOf, localTime, nextWeekday, SECRET, type Salon } from './fixtures'

let s: Salon
// A different future Monday per scenario group keeps the groups independent.
const monday = (week: number) => nextWeekday(1, 3 + 7 * week)

beforeAll(async () => {
  s = await createSalon()
})

describe('availability', () => {
  const day = monday(0)

  it('follows working hours, lunch break and service length', async () => {
    const ama = await s.times(day, s.ids.ama)
    expect(ama[0]).toBe('08:00')
    expect(ama).toContain('11:00') // 11:00–12:00 ends exactly as lunch starts
    expect(ama).not.toContain('11:15') // would run into lunch
    expect(ama).not.toContain('12:00')
    expect(ama).toContain('13:00')
    expect(ama.at(-1)).toBe('16:00') // last start that finishes by 17:00
    expect(ama).toHaveLength(26) // 13 morning + 13 afternoon quarter-hour starts
  })

  it('combines stylists for "any available" and counts who is free', async () => {
    const any = await s.slots(day)
    expect(any[0]).toEqual({ time: '08:00', free: 1 })
    expect(any.find((x) => x.time === '10:00')).toEqual({ time: '10:00', free: 2 })
    expect(any.find((x) => x.time === '12:00')).toEqual({ time: '12:00', free: 1 }) // Bethel covers lunch
    expect(any.at(-1)?.time).toBe('19:00')
  })

  it('fits long services around the break', async () => {
    const braids = await s.times(day, s.ids.ama, s.ids.braids)
    expect(braids).toEqual(['08:00', '08:15', '08:30', '08:45', '09:00', '13:00', '13:15', '13:30', '13:45', '14:00'])
  })

  it('returns nothing on days the team does not work, in the past or beyond the window', async () => {
    expect(await s.times(addDays(day, -1))).toEqual([]) // Sunday
    expect(await s.times(addDays(addisToday(), -1))).toEqual([])
    expect(await s.times(addDays(addisToday(), 61))).toEqual([])
  })

  it('rejects inactive services', async () => {
    expect(await errorOf(s.slots(day, null, s.ids.retired))).toBe('SERVICE_UNAVAILABLE')
  })
})

describe('booking', () => {
  const day = monday(1)

  it('creates a pending request with a reference and correct end time', async () => {
    const booking = await s.book({ stylistId: s.ids.ama, startsAt: at(day, '08:00') })
    expect(booking.status).toBe('pending')
    expect(booking.reference).toMatch(/^OS-[2-9A-HJKMNP-Z]{6}$/)
    expect(booking.stylistId).toBe(s.ids.ama)
    expect(localTime(booking.endsAt)).toBe('09:00')
  })

  it('refuses a slot that is already taken', async () => {
    expect(await errorOf(s.book({ stylistId: s.ids.ama, startsAt: at(day, '08:00'), phone: '+251911000002' }))).toBe('SLOT_TAKEN')
  })

  it('keeps the clean-up buffer free after an appointment', async () => {
    // 08:00–09:00 plus a 15-minute buffer blocks until 09:15.
    expect(await errorOf(s.book({ stylistId: s.ids.ama, startsAt: at(day, '09:00'), phone: '+251911000003' }))).toBe('SLOT_TAKEN')
    await expect(s.book({ stylistId: s.ids.ama, startsAt: at(day, '09:15'), phone: '+251911000003' })).resolves.toBeTruthy()
    const ama = await s.times(day, s.ids.ama)
    expect(ama).not.toContain('08:00')
    expect(ama).not.toContain('09:00')
    expect(ama).not.toContain('10:15') // 09:15 booking + buffer runs to 10:30
    expect(ama).toContain('10:30')
  })

  it('assigns "any available stylist" to whoever is free', async () => {
    // Load Bethel more heavily than Ama so the least-busy ordering tries Ama
    // first; Ama is taken at 11:00, so the booking must fall through to Bethel.
    for (const [time, phone] of [['13:00', '6'], ['16:30', '7'], ['17:45', '8'], ['19:00', '9']]) {
      await s.book({ stylistId: s.ids.bethel, startsAt: at(day, time), phone: `+25191100000${phone}` })
    }
    await s.book({ stylistId: s.ids.ama, startsAt: at(day, '11:00'), phone: '+251911000004' })
    const any = await s.book({ startsAt: at(day, '11:00'), phone: '+251911000005' })
    expect(any.stylistId).toBe(s.ids.bethel)
  })

  it('assigns the least-busy free stylist when several are free', async () => {
    // At 14:30 both are free; Ama has 3 bookings that day, Bethel now 5.
    const any = await s.book({ startsAt: at(day, '14:30'), phone: '+251911000013' })
    expect(any.stylistId).toBe(s.ids.ama)
  })

  it('reuses the customer record without overwriting it', async () => {
    await s.book({ stylistId: s.ids.bethel, startsAt: at(day, '15:00'), name: 'Someone Else' })
    const result = await s.t.run(async (ctx) => {
      const c = await ctx.db.query('customers').withIndex('by_phoneE164', (q) => q.eq('phoneE164', customer.phone)).unique()
      const appointments = await ctx.db.query('appointments').withIndex('by_customerId_and_startsAt', (q) => q.eq('customerId', c!._id)).collect()
      return { fullName: c!.fullName, n: appointments.length }
    })
    expect(result).toEqual({ fullName: customer.name, n: 2 })
  })
})

describe('booking rules', () => {
  const day = monday(2)

  it.each([
    ['before opening', '07:30'],
    ['during lunch', '12:00'],
    ['off the 15-minute grid', '08:07'],
    ['running past closing', '16:30'],
  ])('rejects a time %s', async (_label, time) => {
    expect(await errorOf(s.book({ stylistId: s.ids.ama, startsAt: at(day, time) }))).toBe('SLOT_UNAVAILABLE')
  })

  it('rejects a stylist who does not perform the service', async () => {
    expect(await errorOf(s.book({ serviceId: s.ids.braids, stylistId: s.ids.bethel, startsAt: at(day, '10:00') }))).toBe('STYLIST_UNAVAILABLE')
  })

  it('rejects inactive services, missing policy acceptance and bad phone numbers', async () => {
    expect(await errorOf(s.book({ serviceId: s.ids.retired, stylistId: s.ids.ama, startsAt: at(day, '08:00') }))).toBe('SERVICE_UNAVAILABLE')
    expect(await errorOf(s.book({ stylistId: s.ids.ama, startsAt: at(day, '08:00'), policy: false }))).toBe('POLICY_NOT_ACCEPTED')
    expect(await errorOf(s.book({ stylistId: s.ids.ama, startsAt: at(day, '08:00'), phone: '0911223344' }))).toBe('INVALID_PHONE')
  })

  it('enforces the minimum notice and the booking window', async () => {
    expect(await errorOf(s.book({ startsAt: Date.now() + 30 * 60_000 }))).toBe('TOO_SOON')
    expect(await errorOf(s.book({ startsAt: at(addDays(addisToday(), 90), '10:00') }))).toBe('TOO_FAR')
  })

  it('stops online booking entirely when switched off', async () => {
    const setEnabled = (onlineBookingEnabled: boolean) =>
      s.t.run(async (ctx) => {
        const settings = await ctx.db.query('businessSettings').first()
        await ctx.db.patch('businessSettings', settings!._id, { onlineBookingEnabled })
      })
    await setEnabled(false)
    try {
      expect(await s.times(day)).toEqual([])
      expect(await errorOf(s.book({ stylistId: s.ids.ama, startsAt: at(day, '08:00') }))).toBe('BOOKING_DISABLED')
    } finally {
      await setEnabled(true)
    }
  })
})

describe('time off and closures', () => {
  const day = monday(3)
  const tuesday = addDays(day, 1)

  it('removes a stylist on leave but keeps colleagues bookable', async () => {
    await s.t.run((ctx) => ctx.db.insert('timeOff', { stylistId: s.ids.ama, startsAt: at(day, '00:00'), endsAt: at(day, '23:59'), reason: 'Leave' }))
    expect(await s.times(day, s.ids.ama)).toEqual([])
    expect((await s.times(day)).length).toBeGreaterThan(0)
    expect(await errorOf(s.book({ stylistId: s.ids.ama, startsAt: at(day, '08:00') }))).toBe('SLOT_UNAVAILABLE')
  })

  it('closes the whole salon for a holiday', async () => {
    await s.t.run((ctx) => ctx.db.insert('timeOff', { startsAt: at(tuesday, '00:00'), endsAt: at(tuesday, '23:59'), reason: 'Holiday' }))
    expect(await s.times(tuesday)).toEqual([])
    const days = await s.t.query(api.booking.bookableDaysInRange, {
      serverSecret: SECRET,
      serviceId: s.ids.silkPress,
      stylistId: null,
      from: day,
      to: addDays(day, 2),
      now: Date.now(),
    })
    expect(days).toEqual([day, addDays(day, 2)])
  })
})

describe('concurrency and integrity', () => {
  const day = monday(4)

  it('lets exactly one of two simultaneous requests for a slot succeed', async () => {
    const attempts = await Promise.allSettled([
      s.book({ stylistId: s.ids.ama, startsAt: at(day, '08:00'), phone: '+251911000010' }),
      s.book({ stylistId: s.ids.ama, startsAt: at(day, '08:00'), phone: '+251911000011' }),
    ])
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1)
    const rejected = attempts.find((a) => a.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason.data.code).toBe('SLOT_TAKEN')
  })

  it('never lets staff move an appointment onto another live one', async () => {
    const other = await s.book({ stylistId: s.ids.ama, startsAt: at(day, '10:00'), phone: '+251911000014' })
    expect(other.status).toBe('pending')
    const moving = await s.book({ stylistId: s.ids.ama, startsAt: at(day, '15:30'), phone: '+251911000015' })
    expect(await errorOf(s.desk.mutation(api.appointments.reschedule, { id: moving.appointmentId, startsAt: at(day, '10:30'), stylistId: null }))).toBe(
      'SLOT_UNAVAILABLE',
    )
  })

  it('does not let cancelled appointments block the diary', async () => {
    await s.insertAppointment({ stylistId: s.ids.ama, startsAt: at(day, '13:00'), status: 'cancelled' })
    await expect(s.book({ stylistId: s.ids.ama, startsAt: at(day, '13:00'), phone: '+251911000012' })).resolves.toBeTruthy()
  })
})

describe('customer self-service', () => {
  const day = monday(5)
  const phone = '+251911000020'
  let reference: string

  beforeAll(async () => {
    reference = (await s.book({ stylistId: s.ids.ama, startsAt: at(day, '08:00'), phone })).reference
  })

  const lookup = (ref: string, p: string) => s.t.query(api.booking.lookup, { serverSecret: SECRET, reference: ref, phone: p, now: Date.now() })

  it('only reveals a booking to someone with the reference and the matching phone', async () => {
    expect(await lookup(reference, '+251911999999')).toBeNull()
    const found = await lookup(reference.toLowerCase(), phone)
    expect(found?.booking).toMatchObject({ reference, status: 'pending', canCancel: true, canReschedule: true })
    expect(found?.booking).not.toHaveProperty('customerPhone')
  })

  it('offers reschedule slots that ignore the booking itself', async () => {
    const slots = await s.t.query(api.booking.rescheduleSlots, { serverSecret: SECRET, reference, phone, date: day, now: Date.now() })
    expect(slots.map(localTime)).toContain('08:15') // overlaps only its own current slot
  })

  it('reschedules into a free slot and returns to awaiting confirmation', async () => {
    await s.t.run(async (ctx) => {
      const a = await ctx.db.query('appointments').withIndex('by_reference', (q) => q.eq('reference', reference)).unique()
      await ctx.db.patch('appointments', a!._id, { status: 'confirmed' })
    })
    const { booking } = await s.t.mutation(api.booking.reschedule, { serverSecret: SECRET, reference, phone, startsAt: at(day, '09:30') })
    expect(localTime(booking.startsAt)).toBe('09:30')
    expect(booking.status).toBe('pending')
  })

  it('refuses to reschedule onto someone else’s appointment', async () => {
    await s.book({ stylistId: s.ids.ama, startsAt: at(day, '13:00'), phone: '+251911000021' })
    expect(await errorOf(s.t.mutation(api.booking.reschedule, { serverSecret: SECRET, reference, phone, startsAt: at(day, '13:00') }))).toBe(
      'SLOT_UNAVAILABLE',
    )
  })

  it('cancels, frees the slot and blocks further changes', async () => {
    const { booking } = await s.t.mutation(api.booking.cancel, { serverSecret: SECRET, reference, phone, reason: 'Travelling' })
    expect(booking).toMatchObject({ status: 'cancelled', canCancel: false, canReschedule: false })
    expect(await s.times(day, s.ids.ama)).toContain('09:30')
    expect(await errorOf(s.t.mutation(api.booking.cancel, { serverSecret: SECRET, reference, phone }))).toBe('INVALID_TRANSITION')
  })

  it('enforces the cancellation cutoff', async () => {
    // 3 hours from now is inside the default 12-hour cutoff.
    const id = await s.insertAppointment({ stylistId: s.ids.bethel, startsAt: Date.now() + 3 * 3_600_000 })
    const ref = await s.t.run(async (ctx) => (await ctx.db.get('appointments', id))!.reference)
    expect(await errorOf(s.t.mutation(api.booking.cancel, { serverSecret: SECRET, reference: ref, phone: '+251922000000' }))).toBe('PAST_CUTOFF')
  })
})
