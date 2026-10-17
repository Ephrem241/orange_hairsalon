/**
 * Runs against a real Supabase project (skipped until one is configured):
 *   npm run test:integration
 *
 * Creates its own temporary service + stylist (flagged is_demo), proves that
 * truly concurrent requests for one slot produce exactly one booking, checks
 * that the public API key cannot read private data, then cleans up.
 * Use a development/staging project — never production.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

try {
  process.loadEnvFile('.env.local')
} catch {
  // no local env file: the suite is skipped below
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const secret = process.env.SUPABASE_SECRET_KEY
const configured = Boolean(url && publishable && secret)

const PHONE_PREFIX = '+2519000000'
const tag = `itest-${Date.now().toString(36)}`

describe.skipIf(!configured)('live Supabase project', () => {
  let server: SupabaseClient
  let anon: SupabaseClient
  let serviceId: string
  let stylistId: string
  let slot: string

  beforeAll(async () => {
    server = createClient(url!, secret!, { auth: { persistSession: false } })
    anon = createClient(url!, publishable!, { auth: { persistSession: false } })

    const service = await server.from('services').insert({ slug: tag, name: `Integration ${tag}`, price_etb: 100, duration_min: 30, buffer_min: 0, is_demo: true }).select('id').single()
    if (service.error) throw service.error
    serviceId = service.data.id
    const stylist = await server.from('stylists').insert({ slug: tag, display_name: `Integration ${tag}`, is_demo: true }).select('id').single()
    if (stylist.error) throw stylist.error
    stylistId = stylist.data.id
    await server.from('stylist_services').insert({ stylist_id: stylistId, service_id: serviceId })
    await server.from('working_hours').insert([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ stylist_id: stylistId, weekday, starts_at: '00:00', ends_at: '23:59' })))

    // First bookable slot a few days out, as the public API would see it.
    for (let offset = 3; offset < 20 && !slot; offset++) {
      const date = new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
      const { data } = await server.rpc('get_available_slots', { p_service_id: serviceId, p_stylist_id: stylistId, p_date: date })
      slot = (data as { slot_start: string }[] | null)?.[0]?.slot_start ?? ''
    }
    if (!slot) throw new Error('No bookable slot found — check business hours and booking settings.')
  }, 60_000)

  afterAll(async () => {
    if (!server) return
    await server.from('appointments').delete().eq('service_id', serviceId)
    await server.from('customers').delete().like('phone_e164', `${PHONE_PREFIX}%`)
    await server.from('stylists').delete().eq('id', stylistId)
    await server.from('services').delete().eq('id', serviceId)
  }, 60_000)

  it('accepts exactly one of ten simultaneous bookings for the same slot', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        server.rpc('book_appointment', {
          p_service_id: serviceId,
          p_stylist_id: stylistId,
          p_starts_at: slot,
          p_full_name: 'Integration Test',
          p_phone: `${PHONE_PREFIX}${String(i).padStart(2, '0')}`,
          p_email: null,
          p_notes: null,
          p_policy_accepted: true,
        }),
      ),
    )
    const succeeded = attempts.filter((a) => !a.error)
    expect(succeeded).toHaveLength(1)
    for (const failed of attempts.filter((a) => a.error)) {
      expect(['SLOT_TAKEN', 'SLOT_UNAVAILABLE']).toContain(failed.error!.message)
    }
    const { count } = await server.from('appointments').select('id', { count: 'exact', head: true }).eq('service_id', serviceId).in('status', ['pending', 'confirmed'])
    expect(count).toBe(1)
  }, 60_000)

  it('keeps private tables and booking functions away from the public key', async () => {
    const appointments = await anon.from('appointments').select('id').limit(1)
    expect(appointments.error?.code).toBe('42501')
    const customers = await anon.from('customers').select('id').limit(1)
    expect(customers.error?.code).toBe('42501')
    const contacts = await anon.from('stylist_contacts').select('phone').limit(1)
    expect(contacts.error?.code).toBe('42501')
    const book = await anon.rpc('book_appointment', {
      p_service_id: serviceId, p_stylist_id: stylistId, p_starts_at: slot, p_full_name: 'X Y',
      p_phone: `${PHONE_PREFIX}99`, p_email: null, p_notes: null, p_policy_accepted: true,
    })
    expect(book.error).toBeTruthy()
  })

  it('shows the public key only published catalogue data', async () => {
    const { data, error } = await anon.from('services').select('id, is_active').eq('id', serviceId)
    expect(error).toBeNull()
    expect(data).toEqual([{ id: serviceId, is_active: true }])
  })
})
