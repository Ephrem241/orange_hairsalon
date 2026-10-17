import { beforeAll, describe, expect, it } from 'vitest'
import { at, customer, ids, insertAppointment, localTime, nextWeekday, seedSalon } from './fixtures'
import { as, createTestDb, errorOf, queryAs, type Caller, type Db } from './harness'

const server = { role: 'service_role' } as const
const anon = { role: 'anon' } as const
const owner: Caller = { role: 'authenticated', userId: ids.admin }
const desk: Caller = { role: 'authenticated', userId: ids.reception }
const stylist: Caller = { role: 'authenticated', userId: ids.stylistUser } // linked to Ama
const stranger: Caller = { role: 'authenticated', userId: ids.stranger } // signed in, not staff

let db: Db
const day = nextWeekday(2, 3) // a Tuesday

beforeAll(async () => {
  db = await createTestDb()
  await seedSalon(db)
})

async function bookOnline(stylistId: string, time: string, phone: string) {
  const rows = await queryAs<{ r: { appointment_id: string; reference: string } }>(
    db, server, 'select public.book_appointment($1, $2, $3, $4, $5, null, null, true) as r',
    [ids.silkPress, stylistId, at(day, time), customer.name, phone],
  )
  return rows[0].r
}

const setStatus = (caller: Caller, id: string, status: string, reason: string | null = null, amount: number | null = null) =>
  queryAs<{ r: { status: string; event: string } }>(
    db, caller, 'select public.set_appointment_status($1, $2::public.appointment_status, $3, $4) as r', [id, status, reason, amount],
  ).then((rows) => rows[0].r)

describe('front desk workflow', () => {
  it('books a phone appointment at any free time, already confirmed', async () => {
    const rows = await queryAs<{ r: { status: string; starts_at: string } }>(
      db, desk,
      `select public.staff_create_appointment($1, $2, $3, 'Selam K', '+251911400400', null, 'Called in', 'phone', true) as r`,
      [ids.silkPress, ids.ama, at(day, '08:10')],
    )
    expect(rows[0].r.status).toBe('confirmed')
    expect(localTime(rows[0].r.starts_at)).toBe('08:10')
  })

  it('cannot confirm a request whose slot has been lost to time off', async () => {
    const { appointment_id } = await bookOnline(ids.ama, '13:00', '+251911400401')
    const [{ id: timeOffId }] = await queryAs<{ id: string }>(
      db, desk,
      `insert into public.time_off (stylist_id, starts_at, ends_at, reason) values ($1, $2, $3, 'Doctor') returning id`,
      [ids.ama, at(day, '13:00'), at(day, '14:00')],
    )
    expect(await errorOf(setStatus(desk, appointment_id, 'confirmed'))).toBe('SLOT_NO_LONGER_AVAILABLE')

    await queryAs(db, desk, 'delete from public.time_off where id = $1', [timeOffId])
    expect(await setStatus(desk, appointment_id, 'confirmed')).toMatchObject({ status: 'confirmed', event: 'confirmed' })
  })

  it('enforces the status lifecycle', async () => {
    const { appointment_id } = await bookOnline(ids.bethel, '10:00', '+251911400402')
    expect(await errorOf(setStatus(desk, appointment_id, 'completed'))).toBe('INVALID_TRANSITION')
    expect(await errorOf(setStatus(desk, appointment_id, 'cancelled'))).toBe('REASON_REQUIRED')
    expect(await setStatus(desk, appointment_id, 'cancelled', 'Client asked by phone')).toMatchObject({ event: 'rejected' })
    expect(await errorOf(setStatus(desk, appointment_id, 'confirmed'))).toBe('INVALID_TRANSITION')
  })

  it('cannot mark an appointment completed before it starts', async () => {
    const { appointment_id } = await bookOnline(ids.bethel, '12:00', '+251911400403')
    await setStatus(desk, appointment_id, 'confirmed')
    expect(await errorOf(setStatus(desk, appointment_id, 'completed'))).toBe('NOT_STARTED')
  })

  it('reschedules only into genuinely free time, optionally to another stylist', async () => {
    const { appointment_id } = await bookOnline(ids.ama, '15:00', '+251911400404')
    const reschedule = (start: string, stylistId: string | null = null) =>
      queryAs(db, desk, 'select public.reschedule_appointment($1, $2, $3)', [appointment_id, start, stylistId])

    expect(await errorOf(reschedule(at(day, '08:30')))).toBe('SLOT_UNAVAILABLE') // overlaps the 08:10 phone booking
    await reschedule(at(day, '16:00'), ids.bethel)
    const { rows } = await db.query<{ stylist_id: string; starts_at: Date }>(
      'select stylist_id, starts_at from public.appointments where id = $1', [appointment_id],
    )
    expect(rows[0].stylist_id).toBe(ids.bethel)
    expect(localTime(rows[0].starts_at)).toBe('16:00')

    const events = await queryAs<{ event: string }>(
      db, desk, 'select event from public.appointment_events where appointment_id = $1 order by id', [appointment_id],
    )
    expect(events.map((e) => e.event)).toEqual(['created', 'rescheduled'])
  })

  it('lists staff slots for any stylist', async () => {
    const rows = await queryAs<{ slot_start: Date; slot_stylist_id: string }>(
      db, desk, 'select * from public.staff_available_slots($1, null, $2)', [ids.silkPress, day],
    )
    expect(rows.length).toBeGreaterThan(0)
    expect(new Set(rows.map((r) => r.slot_stylist_id))).toEqual(new Set([ids.ama, ids.bethel]))
  })
})

describe('revenue reporting', () => {
  it('counts recorded revenue from completed appointments only', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString()
    const fiveHoursAgo = new Date(Date.now() - 5 * 3_600_000).toISOString()
    const paidLess = await insertAppointment(db, { stylistId: ids.bethel, startsAt: twoHoursAgo, priceEtb: 1500 })
    const noShow = await insertAppointment(db, { stylistId: ids.ama, startsAt: twoHoursAgo, priceEtb: 1500 })
    const listed = await insertAppointment(db, { stylistId: ids.ama, startsAt: fiveHoursAgo, priceEtb: 2000 })

    await setStatus(desk, paidLess, 'completed', null, 1200)
    await setStatus(desk, noShow, 'no_show')
    await setStatus(desk, listed, 'completed') // no amount entered → listed price

    const from = new Date(Date.now() - 24 * 3_600_000).toISOString()
    const to = new Date(Date.now() - 60_000).toISOString()
    const [{ s }] = await queryAs<{ s: Record<string, number> }>(
      db, owner, 'select public.dashboard_summary($1, $2) as s', [from, to],
    )
    expect(s).toMatchObject({ completed: 2, no_show: 1, recorded_revenue_etb: 3200, expected_revenue_etb: 0 })
  })

  it('reports expected revenue from confirmed, not-yet-completed work', async () => {
    const from = at(day, '00:00')
    const to = at(day, '23:59')
    const { rows } = await db.query<{ expected: number }>(
      `select coalesce(sum(price_etb), 0)::int as expected from public.appointments
       where status = 'confirmed' and starts_at >= $1 and starts_at < $2`, [from, to],
    )
    const [{ s }] = await queryAs<{ s: Record<string, number> }>(db, owner, 'select public.dashboard_summary($1, $2) as s', [from, to])
    expect(s.expected_revenue_etb).toBe(rows[0].expected)
    expect(s.expected_revenue_etb).toBeGreaterThan(0)
    expect(s.recorded_revenue_etb).toBe(0)
  })
})

describe('row-level security and privileges', () => {
  it('hides appointments and customers from the public', async () => {
    expect(await errorOf(queryAs(db, anon, 'select * from public.appointments'))).toMatch(/permission denied/)
    expect(await errorOf(queryAs(db, anon, 'select * from public.customers'))).toMatch(/permission denied/)
    expect(await errorOf(queryAs(db, anon, 'select * from public.stylist_contacts'))).toMatch(/permission denied/)
  })

  it('keeps public booking functions behind the server', async () => {
    const call = `select public.book_appointment($1, null, $2, 'X Y', '+251911000000', null, null, true)`
    expect(await errorOf(queryAs(db, anon, call, [ids.silkPress, at(day, '17:00')]))).toMatch(/permission denied/)
    expect(await errorOf(queryAs(db, stranger, call, [ids.silkPress, at(day, '17:00')]))).toMatch(/permission denied/)
    expect(await errorOf(queryAs(db, anon, 'select public.customer_lookup($1, $2)', ['OS-ABCDEF', '+251911000000']))).toMatch(
      /permission denied/,
    )
    expect(await errorOf(queryAs(db, anon, 'select * from private.rate_limits'))).toMatch(/permission denied/)
  })

  it('shows the public only active services and published content', async () => {
    const services = await queryAs<{ slug: string }>(db, anon, 'select slug from public.services order by slug')
    expect(services.map((s) => s.slug)).toEqual(['knotless-braids', 'silk-press'])
    await db.query(`insert into public.reviews (author_name, body, source) values ('Draft', 'Unverified', 'other')`)
    expect(await queryAs(db, anon, 'select * from public.reviews')).toEqual([])
  })

  it('gives signed-in non-staff users nothing beyond the public view', async () => {
    expect(await queryAs(db, stranger, 'select * from public.appointments')).toEqual([])
    expect(await queryAs(db, stranger, 'select * from public.customers')).toEqual([])
    expect(await errorOf(setStatus(stranger, ids.ama, 'confirmed'))).toBe('FORBIDDEN')
    expect(await errorOf(queryAs(db, stranger, 'select public.staff_available_slots($1, null, $2)', [ids.silkPress, day]))).toBe(
      'FORBIDDEN',
    )
  })

  it('limits stylists to their own diary, read-only', async () => {
    const mine = await queryAs<{ stylist_id: string }>(db, stylist, 'select stylist_id from public.appointments')
    expect(mine.length).toBeGreaterThan(0)
    expect(new Set(mine.map((a) => a.stylist_id))).toEqual(new Set([ids.ama]))
    expect(await queryAs(db, stylist, 'select * from public.customers')).toEqual([])

    const [{ id }] = await queryAs<{ id: string }>(db, stylist, 'select id from public.appointments limit 1')
    expect(await errorOf(setStatus(stylist, id, 'cancelled', 'nope'))).toBe('FORBIDDEN')
    expect(await errorOf(queryAs(db, stylist, `update public.appointments set status = 'cancelled'`))).toMatch(/permission denied/)
  })

  it('lets only admins change business settings and the catalogue', async () => {
    const update = `update public.business_settings set tagline = 'changed' returning tagline`
    expect(await queryAs(db, desk, update)).toEqual([]) // filtered by RLS: no rows updated
    expect(await queryAs(db, owner, update)).toEqual([{ tagline: 'changed' }])

    const price = `update public.services set price_etb = 1 where id = '${ids.silkPress}' returning price_etb`
    expect(await queryAs(db, desk, price)).toEqual([])
    expect(await errorOf(queryAs(db, owner, `update public.services set price_etb = -5 where id = '${ids.silkPress}'`))).toMatch(
      /check constraint/,
    )
    expect(await errorOf(queryAs(db, owner, `update public.services set duration_min = 0 where id = '${ids.silkPress}'`))).toMatch(
      /check constraint/,
    )
  })

  it('records an audit trail of admin changes', async () => {
    const rows = await queryAs<{ actor_id: string; entity: string; action: string }>(
      db, owner, `select actor_id, entity, action from public.audit_events where entity = 'business_settings' and actor_id is not null`,
    )
    expect(rows).toContainEqual({ actor_id: ids.admin, entity: 'business_settings', action: 'update' })
    expect(await queryAs(db, desk, 'select * from public.audit_events')).toEqual([])
  })

  it('never removes the last active admin', async () => {
    const demote = `update public.profiles set role = 'receptionist' where id = $1`
    expect(await errorOf(queryAs(db, owner, demote, [ids.admin]))).toBe('LAST_ADMIN')

    // With a second admin the first can step down.
    await db.query(`insert into public.profiles (id, full_name, role) values ($1, 'Co-owner', 'admin')`, [ids.admin2])
    await queryAs(db, owner, demote, [ids.admin])
    const { rows } = await db.query<{ role: string }>('select role from public.profiles where id = $1', [ids.admin])
    expect(rows[0].role).toBe('receptionist')
  })

  it('stops staff from rewriting a customer’s phone number', async () => {
    const message = await errorOf(queryAs(db, desk, `update public.customers set phone_e164 = '+251900000000'`))
    expect(message).toMatch(/permission denied/)
  })

  it('rate-limits with a fixed window', async () => {
    const hit = () =>
      queryAs<{ ok: boolean }>(db, server, `select public.consume_rate_limit('test:key', 2, 60) as ok`).then((r) => r[0].ok)
    expect([await hit(), await hit(), await hit()]).toEqual([true, true, false])
  })
})

describe('atomic admin helpers', () => {
  it('replaces a weekly schedule and rejects overlapping shifts', async () => {
    const admin2: Caller = { role: 'authenticated', userId: ids.admin2 }
    const set = (hours: unknown) =>
      queryAs(db, admin2, 'select public.set_stylist_schedule($1, $2::jsonb, $3::jsonb)', [ids.bethel, JSON.stringify(hours), '[]'])

    const overlapping = [
      { weekday: 1, starts_at: '09:00', ends_at: '13:00' },
      { weekday: 1, starts_at: '12:00', ends_at: '18:00' },
    ]
    expect(await errorOf(set(overlapping))).toBe('SCHEDULE_OVERLAP')
    expect(await errorOf(set([{ weekday: 1, starts_at: '18:00', ends_at: '09:00' }]))).toBe('INVALID_SCHEDULE')

    await set([
      { weekday: 1, starts_at: '09:00', ends_at: '13:00' },
      { weekday: 1, starts_at: '14:00', ends_at: '18:00' },
    ])
    const { rows } = await db.query<{ n: number }>('select count(*)::int as n from public.working_hours where stylist_id = $1', [ids.bethel])
    expect(rows[0].n).toBe(2)
    expect(await errorOf(queryAs(db, desk, 'select public.set_stylist_schedule($1, $2::jsonb, $3::jsonb)', [ids.bethel, '[]', '[]']))).toBe(
      'FORBIDDEN',
    )
  })

  it('reorders the gallery in one statement', async () => {
    const admin2: Caller = { role: 'authenticated', userId: ids.admin2 }
    const { rows } = await db.query<{ id: string }>('select id from public.gallery_items order by sort_order')
    const reversed = rows.map((r) => r.id).reverse()
    await as(db, admin2, (tx) => tx.query('select public.reorder_gallery($1::uuid[])', [reversed]))
    const after = await db.query<{ id: string }>('select id from public.gallery_items order by sort_order')
    expect(after.rows.map((r) => r.id)).toEqual(reversed)
  })
})
