import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { nextWeekday } from './fixtures'
import { createTestDb, queryAs, type Db } from './harness'

let db: Db

beforeAll(async () => {
  db = await createTestDb()
})

describe('migrations', () => {
  it('apply cleanly and seed only verified business details', async () => {
    const { rows } = await db.query<{ name: string; phone: string; address_line: string; currency: string; timezone: string }>(
      'select name, phone, address_line, currency, timezone from public.business_settings',
    )
    expect(rows).toEqual([
      {
        name: 'Orange Salon',
        phone: '+251912419748',
        address_line: 'Ednamoll Street',
        currency: 'ETB',
        timezone: 'Africa/Addis_Ababa',
      },
    ])
  })

  it('seed the verified opening hours', async () => {
    const { rows } = await db.query<{ weekday: number; opens_at: string; closes_at: string }>(
      'select weekday, opens_at::text, closes_at::text from public.business_hours order by weekday',
    )
    expect(rows[0]).toEqual({ weekday: 0, opens_at: '09:00:00', closes_at: '19:30:00' })
    for (const day of rows.slice(1)) {
      expect(day).toMatchObject({ opens_at: '08:00:00', closes_at: '20:00:00' })
    }
  })

  it('ship no services, stylists or reviews (the owner enters those)', async () => {
    const { rows } = await db.query<{ services: number; stylists: number; reviews: number }>(`
      select (select count(*)::int from public.services) as services,
             (select count(*)::int from public.stylists) as stylists,
             (select count(*)::int from public.reviews) as reviews`)
    expect(rows[0]).toEqual({ services: 0, stylists: 0, reviews: 0 })
  })

  it('pin currency and time zone', async () => {
    await expect(db.query(`update public.business_settings set currency = 'USD'`)).rejects.toThrow()
    await expect(db.query(`update public.business_settings set timezone = 'UTC'`)).rejects.toThrow()
  })

  // Runs last: it adds rows the assertions above expect to be absent.
  it('accept the development demo seed, flagged as demo and bookable', async () => {
    await db.exec(readFileSync(join(__dirname, '..', '..', 'supabase', 'seed.demo.sql'), 'utf8'))
    const { rows } = await db.query<{ total: number; demo: number }>(
      'select count(*)::int as total, count(*) filter (where is_demo)::int as demo from public.services',
    )
    expect(rows[0].total).toBeGreaterThan(0)
    expect(rows[0].demo).toBe(rows[0].total)

    const slots = await queryAs(
      db, { role: 'service_role' },
      `select * from public.get_available_slots((select id from public.services where slug = 'demo-silk-press'), null, $1)`,
      [nextWeekday(1, 3)],
    )
    expect(slots.length).toBeGreaterThan(20)
  })
})
