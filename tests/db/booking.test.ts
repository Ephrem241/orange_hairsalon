import { beforeAll, describe, expect, it } from 'vitest'
import { addDays, addisToday, at, customer, ids, insertAppointment, localTime, nextWeekday, seedSalon } from './fixtures'
import { createTestDb, errorOf, queryAs, type Db } from './harness'

type Booking = { appointment_id: string; reference: string; status: string; stylist_id: string; starts_at: string; ends_at: string }
type CustomerView = { reference: string; status: string; can_cancel: boolean; can_reschedule: boolean; starts_at: string; stylist_name: string }

const server = { role: 'service_role' } as const

let db: Db
// A different future Monday per scenario group keeps the groups independent.
const monday = (week: number) => nextWeekday(1, 3 + 7 * week)

beforeAll(async () => {
  db = await createTestDb()
  await seedSalon(db)
})

async function book(opts: {
  startsAt: string
  stylistId?: string | null
  serviceId?: string
  phone?: string
  name?: string
  policy?: boolean
}): Promise<Booking> {
  const rows = await queryAs<{ result: Booking }>(
    db, server,
    'select public.book_appointment($1, $2, $3, $4, $5, $6, $7, $8) as result',
    [
      opts.serviceId ?? ids.silkPress, opts.stylistId ?? null, opts.startsAt, opts.name ?? customer.name,
      opts.phone ?? customer.phone, customer.email, null, opts.policy ?? true,
    ],
  )
  return rows[0].result
}

async function slots(date: string, stylistId: string | null = null, serviceId: string = ids.silkPress) {
  const rows = await queryAs<{ slot_start: Date; stylists_free: number }>(
    db, server, 'select * from public.get_available_slots($1, $2, $3)', [serviceId, stylistId, date],
  )
  return rows.map((r) => ({ time: localTime(r.slot_start), free: r.stylists_free }))
}
const times = async (...args: Parameters<typeof slots>) => (await slots(...args)).map((s) => s.time)

describe('availability', () => {
  const day = monday(0)

  it('follows working hours, lunch break and service length', async () => {
    const ama = await times(day, ids.ama)
    expect(ama[0]).toBe('08:00')
    expect(ama).toContain('11:00') // 11:00–12:00 ends exactly as lunch starts
    expect(ama).not.toContain('11:15') // would run into lunch
    expect(ama).not.toContain('12:00')
    expect(ama).toContain('13:00')
    expect(ama.at(-1)).toBe('16:00') // last start that finishes by 17:00
    expect(ama).toHaveLength(26) // 13 morning + 13 afternoon quarter-hour starts
  })

  it('combines stylists for "any available" and counts who is free', async () => {
    const any = await slots(day)
    expect(any[0]).toEqual({ time: '08:00', free: 1 })
    expect(any.find((s) => s.time === '10:00')).toEqual({ time: '10:00', free: 2 })
    expect(any.find((s) => s.time === '12:00')).toEqual({ time: '12:00', free: 1 }) // Bethel covers lunch
    expect(any.at(-1)?.time).toBe('19:00')
  })

  it('fits long services around the break', async () => {
    const braids = await times(day, ids.ama, ids.braids)
    expect(braids).toEqual(['08:00', '08:15', '08:30', '08:45', '09:00', '13:00', '13:15', '13:30', '13:45', '14:00'])
  })

  it('returns nothing on days the team does not work, in the past or beyond the window', async () => {
    expect(await times(addDays(day, -1))).toEqual([]) // Sunday
    expect(await times(addDays(addisToday(), -1))).toEqual([])
    expect(await times(addDays(addisToday(), 61))).toEqual([])
  })

  it('rejects inactive services', async () => {
    expect(await errorOf(slots(day, null, ids.retired))).toBe('SERVICE_UNAVAILABLE')
  })
})

describe('booking', () => {
  const day = monday(1)

  it('creates a pending request with a reference and correct end time', async () => {
    const booking = await book({ stylistId: ids.ama, startsAt: at(day, '08:00') })
    expect(booking.status).toBe('pending')
    expect(booking.reference).toMatch(/^OS-[2-9A-HJKMNP-Z]{6}$/)
    expect(booking.stylist_id).toBe(ids.ama)
    expect(localTime(booking.ends_at)).toBe('09:00')
  })

  it('refuses a slot that is already taken', async () => {
    expect(await errorOf(book({ stylistId: ids.ama, startsAt: at(day, '08:00'), phone: '+251911000002' }))).toBe('SLOT_TAKEN')
  })

  it('keeps the clean-up buffer free after an appointment', async () => {
    // 08:00–09:00 plus a 15-minute buffer blocks until 09:15.
    expect(await errorOf(book({ stylistId: ids.ama, startsAt: at(day, '09:00'), phone: '+251911000003' }))).toBe('SLOT_TAKEN')
    await expect(book({ stylistId: ids.ama, startsAt: at(day, '09:15'), phone: '+251911000003' })).resolves.toBeTruthy()
    const ama = await times(day, ids.ama)
    expect(ama).not.toContain('08:00')
    expect(ama).not.toContain('09:00')
    expect(ama).not.toContain('10:15') // 09:15 booking + buffer runs to 10:30
    expect(ama).toContain('10:30')
  })

  it('assigns "any available stylist" to whoever is free', async () => {
    // Load Bethel more heavily than Ama so the least-busy ordering tries Ama
    // first; Ama is taken at 11:00, so the booking must fall through to Bethel.
    for (const [time, phone] of [['13:00', '6'], ['16:30', '7'], ['17:45', '8'], ['19:00', '9']]) {
      await book({ stylistId: ids.bethel, startsAt: at(day, time), phone: `+25191100000${phone}` })
    }
    await book({ stylistId: ids.ama, startsAt: at(day, '11:00'), phone: '+251911000004' })
    const any = await book({ startsAt: at(day, '11:00'), phone: '+251911000005' })
    expect(any.stylist_id).toBe(ids.bethel)
  })

  it('assigns the least-busy free stylist when several are free', async () => {
    // At 14:30 both are free; Ama has 3 bookings that day, Bethel now 5.
    const any = await book({ startsAt: at(day, '14:30'), phone: '+251911000013' })
    expect(any.stylist_id).toBe(ids.ama)
  })

  it('reuses the customer record without overwriting it', async () => {
    await book({ stylistId: ids.bethel, startsAt: at(day, '15:00'), name: 'Someone Else' })
    const { rows } = await db.query<{ full_name: string; n: number }>(
      `select c.full_name, (select count(*)::int from public.appointments a where a.customer_id = c.id) as n
       from public.customers c where c.phone_e164 = $1`,
      [customer.phone],
    )
    expect(rows).toEqual([{ full_name: customer.name, n: 2 }])
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
    expect(await errorOf(book({ stylistId: ids.ama, startsAt: at(day, time) }))).toBe('SLOT_UNAVAILABLE')
  })

  it('rejects a stylist who does not perform the service', async () => {
    expect(await errorOf(book({ serviceId: ids.braids, stylistId: ids.bethel, startsAt: at(day, '10:00') }))).toBe(
      'STYLIST_UNAVAILABLE',
    )
  })

  it('rejects inactive services, missing policy acceptance and bad phone numbers', async () => {
    expect(await errorOf(book({ serviceId: ids.retired, stylistId: ids.ama, startsAt: at(day, '08:00') }))).toBe('SERVICE_UNAVAILABLE')
    expect(await errorOf(book({ stylistId: ids.ama, startsAt: at(day, '08:00'), policy: false }))).toBe('POLICY_NOT_ACCEPTED')
    expect(await errorOf(book({ stylistId: ids.ama, startsAt: at(day, '08:00'), phone: '0911223344' }))).toBe('INVALID_PHONE')
  })

  it('enforces the minimum notice and the booking window', async () => {
    const soon = new Date(Date.now() + 30 * 60_000).toISOString()
    expect(await errorOf(book({ startsAt: soon }))).toBe('TOO_SOON')
    expect(await errorOf(book({ startsAt: at(addDays(addisToday(), 90), '10:00') }))).toBe('TOO_FAR')
  })

  it('stops online booking entirely when switched off', async () => {
    await db.query('update public.business_settings set online_booking_enabled = false')
    try {
      expect(await times(day)).toEqual([])
      expect(await errorOf(book({ stylistId: ids.ama, startsAt: at(day, '08:00') }))).toBe('BOOKING_DISABLED')
    } finally {
      await db.query('update public.business_settings set online_booking_enabled = true')
    }
  })
})

describe('time off and closures', () => {
  const day = monday(3)
  const tuesday = addDays(day, 1)

  it('removes a stylist on leave but keeps colleagues bookable', async () => {
    await db.query(`insert into public.time_off (stylist_id, starts_at, ends_at, reason) values ($1, $2, $3, 'Leave')`, [
      ids.ama, at(day, '00:00'), at(day, '23:59'),
    ])
    expect(await times(day, ids.ama)).toEqual([])
    expect((await times(day)).length).toBeGreaterThan(0)
    expect(await errorOf(book({ stylistId: ids.ama, startsAt: at(day, '08:00') }))).toBe('SLOT_UNAVAILABLE')
  })

  it('closes the whole salon for a holiday', async () => {
    await db.query(`insert into public.time_off (stylist_id, starts_at, ends_at, reason) values (null, $1, $2, 'Holiday')`, [
      at(tuesday, '00:00'), at(tuesday, '23:59'),
    ])
    expect(await times(tuesday)).toEqual([])
    const days = await queryAs<{ d: string }>(
      db, server, 'select d::text from public.get_bookable_days($1, null, $2, $3) as d', [ids.silkPress, day, addDays(day, 2)],
    )
    expect(days.map((r) => r.d)).toEqual([day, addDays(day, 2)])
  })
})

describe('concurrency and integrity', () => {
  const day = monday(4)

  it('lets exactly one of two simultaneous requests for a slot succeed', async () => {
    const attempts = await Promise.allSettled([
      book({ stylistId: ids.ama, startsAt: at(day, '08:00'), phone: '+251911000010' }),
      book({ stylistId: ids.ama, startsAt: at(day, '08:00'), phone: '+251911000011' }),
    ])
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1)
    const rejected = attempts.find((a) => a.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason.message).toBe('SLOT_TAKEN')
  })

  it('makes overlapping live appointments impossible at the table level', async () => {
    const message = await errorOf(insertAppointment(db, { stylistId: ids.ama, startsAt: at(day, '08:30') }))
    expect(message).toMatch(/appointments_no_overlap/)
  })

  it('does not let cancelled appointments block the diary', async () => {
    await insertAppointment(db, { stylistId: ids.ama, startsAt: at(day, '13:00'), status: 'cancelled' })
    await expect(book({ stylistId: ids.ama, startsAt: at(day, '13:00'), phone: '+251911000012' })).resolves.toBeTruthy()
  })
})

describe('customer self-service', () => {
  const day = monday(5)
  let booking: Booking

  beforeAll(async () => {
    booking = await book({ stylistId: ids.ama, startsAt: at(day, '08:00'), phone: '+251911000020' })
  })

  const lookup = async (reference: string, phone: string) =>
    (await queryAs<{ v: CustomerView | null }>(db, server, 'select public.customer_lookup($1, $2) as v', [reference, phone]))[0].v

  it('only reveals a booking to someone with the reference and the matching phone', async () => {
    expect(await lookup(booking.reference, '+251911999999')).toBeNull()
    const view = await lookup(booking.reference.toLowerCase(), '+251911000020')
    expect(view).toMatchObject({ reference: booking.reference, status: 'pending', can_cancel: true, can_reschedule: true })
    expect(view).not.toHaveProperty('customer_phone')
  })

  it('offers reschedule slots that ignore the booking itself', async () => {
    const rows = await queryAs<{ s: Date }>(
      db, server, 'select s from public.customer_reschedule_slots($1, $2, $3) as s', [booking.reference, '+251911000020', day],
    )
    expect(rows.map((r) => localTime(r.s))).toContain('08:15') // overlaps only its own current slot
  })

  it('reschedules into a free slot and returns to awaiting confirmation', async () => {
    await db.query(`update public.appointments set status = 'confirmed' where reference = $1`, [booking.reference])
    const rows = await queryAs<{ v: CustomerView }>(
      db, server, 'select public.customer_reschedule($1, $2, $3) as v', [booking.reference, '+251911000020', at(day, '09:30')],
    )
    expect(localTime(rows[0].v.starts_at)).toBe('09:30')
    expect(rows[0].v.status).toBe('pending')
  })

  it('refuses to reschedule onto someone else’s appointment', async () => {
    await book({ stylistId: ids.ama, startsAt: at(day, '13:00'), phone: '+251911000021' })
    const message = await errorOf(
      queryAs(db, server, 'select public.customer_reschedule($1, $2, $3)', [booking.reference, '+251911000020', at(day, '13:00')]),
    )
    expect(message).toBe('SLOT_UNAVAILABLE')
  })

  it('cancels, frees the slot and blocks further changes', async () => {
    const rows = await queryAs<{ v: CustomerView }>(
      db, server, 'select public.customer_cancel($1, $2, $3) as v', [booking.reference, '+251911000020', 'Travelling'],
    )
    expect(rows[0].v).toMatchObject({ status: 'cancelled', can_cancel: false, can_reschedule: false })
    expect(await times(day, ids.ama)).toContain('09:30')
    const again = await errorOf(
      queryAs(db, server, 'select public.customer_cancel($1, $2, null)', [booking.reference, '+251911000020']),
    )
    expect(again).toBe('INVALID_TRANSITION')
  })

  it('enforces the cancellation cutoff', async () => {
    // 3 hours from now is inside the default 12-hour cutoff.
    const soon = new Date(Date.now() + 3 * 3_600_000).toISOString()
    const id = await insertAppointment(db, { stylistId: ids.bethel, startsAt: soon })
    const { rows } = await db.query<{ reference: string }>('select reference from public.appointments where id = $1', [id])
    const message = await errorOf(
      queryAs(db, server, 'select public.customer_cancel($1, $2, null)', [rows[0].reference, '+251922000000']),
    )
    expect(message).toBe('PAST_CUTOFF')
  })
})
