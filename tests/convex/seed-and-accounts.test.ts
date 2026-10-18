// @vitest-environment edge-runtime
import { api, internal } from '@convex/_generated/api'
import schema from '@convex/schema'
import { convexTest } from 'convex-test'
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { addDays, errorOf, modules, nextWeekday, SECRET } from './fixtures'

describe('verified seed', () => {
  const t = convexTest(schema, modules)

  beforeAll(async () => {
    await t.mutation(internal.seed.verified, {})
    await t.mutation(internal.seed.verified, {}) // idempotent
  })

  it('seeds only verified business details, including the salon’s map pin', async () => {
    const settings = await t.query(api.public.settings, {})
    expect(settings).toMatchObject({
      name: 'Orange Salon',
      phone: '+251912419748',
      addressLine: 'Ednamoll Street',
      city: 'Addis Ababa',
      mapUrl: 'https://maps.app.goo.gl/v35jnnonHKEXdFyr8',
      latitude: 8.9949867,
      longitude: 38.7851034,
      socials: {},
    })
    expect(settings?.email).toBeUndefined()
    expect(settings?.whatsapp).toBeUndefined()
  })

  it('adds a missing map pin to existing settings but never overwrites the owner’s', async () => {
    const t2 = convexTest(schema, modules)
    await t2.mutation(internal.seed.verified, {})
    await t2.run(async (ctx) => {
      const s = (await ctx.db.query('businessSettings').first())!
      await ctx.db.patch('businessSettings', s._id, { mapUrl: undefined, latitude: undefined, longitude: undefined })
    })
    await t2.mutation(internal.seed.verified, {})
    expect(await t2.query(api.public.settings, {})).toMatchObject({ mapUrl: 'https://maps.app.goo.gl/v35jnnonHKEXdFyr8', latitude: 8.9949867 })

    await t2.run(async (ctx) => {
      const s = (await ctx.db.query('businessSettings').first())!
      await ctx.db.patch('businessSettings', s._id, { mapUrl: 'https://maps.app.goo.gl/owner-choice' })
    })
    await t2.mutation(internal.seed.verified, {})
    expect((await t2.query(api.public.settings, {}))?.mapUrl).toBe('https://maps.app.goo.gl/owner-choice')
  })

  it('seeds the verified opening hours', async () => {
    const hours = await t.query(api.public.businessHours, {})
    expect(hours).toHaveLength(7)
    expect(hours[0]).toMatchObject({ weekday: 0, opensAt: '09:00', closesAt: '19:30', isClosed: false })
    for (const day of hours.slice(1)) expect(day).toMatchObject({ opensAt: '08:00', closesAt: '20:00' })
  })

  it('ships no services, stylists or reviews (the owner enters those) and only genuine photos', async () => {
    expect(await t.query(api.public.services, {})).toEqual([])
    expect(await t.query(api.public.stylists, {})).toEqual([])
    expect(await t.query(api.public.reviews, {})).toEqual([])
    const gallery = await t.query(api.public.gallery, {})
    expect(gallery).toHaveLength(11)
    expect(gallery.every((g) => g.source === 'salon' && g.mediaPath.startsWith('/'))).toBe(true)
  })
})

describe('demo seed', () => {
  const t = convexTest(schema, modules)

  it('refuses to run unless the deployment allows it', async () => {
    vi.stubEnv('ALLOW_DEMO_SEED', '')
    expect(await errorOf(t.mutation(internal.seed.demo, {}))).toBe('DEMO_SEED_DISABLED')
  })

  it('creates a bookable sample menu, all flagged as demo, and removes it again', async () => {
    vi.stubEnv('ALLOW_DEMO_SEED', 'true')
    vi.stubEnv('CONVEX_SERVER_SECRET', SECRET)
    await t.mutation(internal.seed.demo, {})
    const services = await t.query(api.public.services, {})
    expect(services.length).toBeGreaterThan(0)
    expect(services.every((s) => s.isDemo)).toBe(true)

    const silk = services.find((s) => s.slug === 'demo-silk-press')!
    const slots = await t.query(api.booking.availability, { serverSecret: SECRET, serviceId: silk._id, stylistId: null, date: nextWeekday(1, 3), now: Date.now() })
    expect(slots.length).toBeGreaterThan(20)

    await t.mutation(internal.seed.removeDemo, {})
    expect(await t.query(api.public.services, {})).toEqual([])
    expect(await t.query(api.public.stylists, {})).toEqual([])
    expect(await t.query(api.public.categories, {})).toEqual([])
  })
})

describe('starter menu', () => {
  const t = convexTest(schema, modules)

  it('publishes the menu as real rows: no demo names or flags, and no stylists', async () => {
    await t.mutation(internal.seed.sampleMenu, {})
    await t.mutation(internal.seed.sampleMenu, {}) // idempotent
    const services = await t.query(api.public.services, {})
    expect(services).toHaveLength(8)
    expect(services.every((s) => !s.isDemo && !s.name.includes('demo') && !s.slug.startsWith('demo-'))).toBe(true)
    expect(services.every((s) => s.category !== null)).toBe(true)
    expect(await t.query(api.public.stylists, {})).toEqual([])
  })

  it('keeps its categories when demo data that shared them is removed', async () => {
    vi.stubEnv('ALLOW_DEMO_SEED', 'true')
    await t.mutation(internal.seed.demo, {})
    await t.mutation(internal.seed.sampleMenu, {})
    await t.mutation(internal.seed.removeDemo, {})
    const services = await t.query(api.public.services, {})
    expect(services).toHaveLength(8)
    expect(services.every((s) => s.category !== null)).toBe(true)
    expect(await t.query(api.public.categories, {})).toHaveLength(5)
  })
})

describe('staff accounts', () => {
  const t = convexTest(schema, modules)
  const ownerPassword = 'owner-password-1234'

  beforeAll(async () => {
    // Convex Auth signs session tokens with these keys (set per deployment in real life).
    const keys = await generateKeyPair('RS256', { extractable: true })
    vi.stubEnv('JWT_PRIVATE_KEY', (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, ' '))
    vi.stubEnv('JWKS', JSON.stringify({ keys: [{ use: 'sig', ...(await exportJWK(keys.publicKey)) }] }))
    vi.stubEnv('SITE_URL', 'http://localhost:3000')
    vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3211')
    await t.mutation(internal.seed.verified, {})
  })

  const signIn = (email: string, password: string) =>
    t.action(api.auth.signIn, { provider: 'password', params: { email, password, flow: 'signIn' } })

  /** Acting as a signed-in user: the identity Convex Auth puts in its tokens. */
  async function actingAs(email: string) {
    const userId = await t.run(async (ctx) => (await ctx.db.query('staffProfiles').withIndex('by_email', (q) => q.eq('email', email)).unique())!.userId)
    return t.withIdentity({ subject: `${userId}|test-session`, issuer: 'test' })
  }

  it('bootstraps the first admin, and resets them when run again', async () => {
    expect(await t.action(internal.staff.bootstrapAdmin, { email: 'Owner@Example.com', name: 'Owner', password: 'first-password-1234' })).toEqual({ created: true })
    expect(await t.action(internal.staff.bootstrapAdmin, { email: 'owner@example.com', name: 'Owner', password: ownerPassword })).toEqual({ created: false })
    const owner = await actingAs('owner@example.com')
    expect(await owner.query(api.staff.me, {})).toMatchObject({ role: 'admin', email: 'owner@example.com' })
  })

  it('signs staff in with their password and rejects a wrong one', async () => {
    const result = await signIn('owner@example.com', ownerPassword)
    expect(result.tokens?.token).toBeTruthy()
    await expect(signIn('owner@example.com', 'first-password-1234')).rejects.toThrow()
  })

  it('has no public sign-up', async () => {
    await expect(
      t.action(api.auth.signIn, { provider: 'password', params: { email: 'someone@example.com', password: 'a-long-password-123', flow: 'signUp' } }),
    ).rejects.toThrow()
    const accounts = await t.run((ctx) => ctx.db.query('authAccounts').collect())
    expect(accounts.map((a) => a.providerAccountId)).toEqual(['owner@example.com'])
  })

  it('lets only an admin create staff logins', async () => {
    const owner = await actingAs('owner@example.com')
    const desk = { email: 'desk@example.com', fullName: 'Front desk', role: 'receptionist' as const, stylistId: null, password: 'desk-temporary-123' }
    await owner.action(api.staff.createStaff, desk)
    expect((await signIn('desk@example.com', 'desk-temporary-123')).tokens?.token).toBeTruthy()
    expect(await errorOf(owner.action(api.staff.createStaff, desk))).toBe('ACCOUNT_EXISTS')

    const receptionist = await actingAs('desk@example.com')
    expect(await errorOf(receptionist.action(api.staff.createStaff, { ...desk, email: 'other@example.com' }))).toBe('FORBIDDEN')
    expect(await errorOf(owner.action(api.staff.createStaff, { ...desk, email: 'weak@example.com', password: 'short' }))).toBe('WEAK_PASSWORD')
  })

  it('resets a password so only the new one works', async () => {
    const owner = await actingAs('owner@example.com')
    const deskProfile = (await owner.query(api.staff.list, {})).find((p) => p.email === 'desk@example.com')!
    await owner.action(api.staff.resetPassword, { id: deskProfile._id, password: 'desk-new-password-1' })
    await expect(signIn('desk@example.com', 'desk-temporary-123')).rejects.toThrow()
    expect((await signIn('desk@example.com', 'desk-new-password-1')).tokens?.token).toBeTruthy()
  })

  it('removes dashboard access when a profile is deactivated', async () => {
    const owner = await actingAs('owner@example.com')
    const deskProfile = (await owner.query(api.staff.list, {})).find((p) => p.email === 'desk@example.com')!
    await owner.mutation(api.staff.update, { id: deskProfile._id, fullName: 'Front desk', role: 'receptionist', stylistId: null, isActive: false })
    const receptionist = await actingAs('desk@example.com')
    expect(await receptionist.query(api.staff.me, {})).toBeNull()
    expect(await errorOf(receptionist.query(api.appointments.list, { from: Date.parse(addDays('2026-01-01', 0)) }))).toBe('FORBIDDEN')
  })
})
