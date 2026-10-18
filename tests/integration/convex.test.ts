/**
 * Runs against a real Convex deployment (the one in .env.local) — use a local
 * or development deployment, never production:
 *
 *   npx convex env set ALLOW_DEMO_SEED true && npx convex run seed:demo
 *   npm run test:integration
 *
 * It fires ten simultaneous bookings at one slot and expects exactly one to
 * succeed, and checks that server-only and staff-only functions refuse
 * callers without the server secret or a staff session. Its one booking is
 * cancelled afterwards (seed:removeDemo deletes it with the rest of the demo).
 *
 * Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD (an admin on that deployment)
 * to also check uploads: stored, resolved to a working URL, and cleaned up.
 */
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { ConvexHttpClient } from 'convex/browser'
import { existsSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? ''
const serverSecret = process.env.CONVEX_SERVER_SECRET ?? ''
const configured = Boolean(url && serverSecret)

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (error) {
    return (error as { data?: { code?: string } }).data?.code ?? (error as Error).message
  }
  return 'OK'
}

/** A Monday about seven weeks out, inside the default 60-day window. */
function futureMonday(): string {
  const date = new Date(Date.now() + 45 * 86_400_000)
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

describe.skipIf(!configured)('live Convex deployment', () => {
  const client = new ConvexHttpClient(url)
  let serviceId: Id<'services'>
  let stylistId: Id<'stylists'>
  let booked: { reference: string; phone: string } | null = null

  beforeAll(async () => {
    const [services, stylists] = await Promise.all([client.query(api.public.services, {}), client.query(api.public.stylists, {})])
    const service = services.find((s) => s.slug === 'demo-silk-press')
    if (!service) throw new Error('Run the demo seed on this deployment first (see the comment at the top of this file).')
    const stylist = stylists.find((s) => s.serviceIds.includes(service._id))!
    serviceId = service._id
    stylistId = stylist._id
  })

  afterAll(async () => {
    if (booked) await client.mutation(api.booking.cancel, { serverSecret, ...booked, reason: 'Integration test' })
  })

  it('accepts exactly one of ten simultaneous bookings for the same slot', async () => {
    const date = futureMonday()
    const slots = await client.query(api.booking.availability, { serverSecret, serviceId, stylistId, date, now: Date.now() })
    expect(slots.length).toBeGreaterThan(0)
    const startsAt = slots[Math.floor(slots.length / 2)].slotStart

    const phones = Array.from({ length: 10 }, (_, i) => `+25191199${String(Date.now()).slice(-4)}${i}`)
    const attempts = await Promise.allSettled(
      phones.map((phone) =>
        // Separate clients so the requests really are concurrent HTTP calls.
        new ConvexHttpClient(url).mutation(api.booking.book, {
          serverSecret,
          serviceId,
          stylistId,
          startsAt,
          fullName: 'Integration Test',
          phone,
          policyAccepted: true,
        }),
      ),
    )
    const won = attempts.flatMap((a, i) => (a.status === 'fulfilled' ? [{ reference: a.value.reference, phone: phones[i] }] : []))
    expect(won).toHaveLength(1)
    booked = won[0]
    for (const a of attempts) {
      if (a.status === 'rejected') expect((a.reason as { data?: { code?: string } }).data?.code).toBe('SLOT_TAKEN')
    }
  })

  it('keeps server-only functions behind the server secret', async () => {
    const book = { serviceId, stylistId, startsAt: Date.now() + 86_400_000, fullName: 'X Y', phone: '+251911000000', policyAccepted: true }
    expect(await codeOf(client.mutation(api.booking.book, { ...book, serverSecret: 'not-the-secret-not-the-secret' }))).toBe('FORBIDDEN')
    expect(await codeOf(client.query(api.booking.lookup, { serverSecret: '', reference: 'OS-ABCDEF', phone: '+251911000000', now: Date.now() }))).toBe('FORBIDDEN')
    expect(await codeOf(client.mutation(api.rateLimit.consume, { serverSecret: 'x', key: 'k', limit: 1, windowSeconds: 1 }))).toBe('FORBIDDEN')
    expect(await codeOf(client.query(api.notifications.context, { serverSecret: 'x', appointmentId: 'x' as Id<'appointments'> }))).not.toBe('OK')
  })

  it('refuses dashboard functions without a staff session', async () => {
    expect(await codeOf(client.query(api.appointments.list, {}))).toBe('FORBIDDEN')
    expect(await codeOf(client.query(api.customers.list, {}))).toBe('FORBIDDEN')
    expect(await codeOf(client.mutation(api.media.generateUploadUrl, {}))).toBe('FORBIDDEN')
    expect(await client.query(api.staff.me, {})).toBeNull()
  })

  it('shows the public only published catalogue data, without private contacts', async () => {
    const services = await client.query(api.public.services, {})
    expect(services.every((s) => s.isActive)).toBe(true)
    const stylists = await client.query(api.public.stylists, {})
    for (const s of stylists) expect(Object.keys(s)).not.toContain('phone')
    expect((await client.query(api.public.reviews, {})).every((r) => r.isPublished)).toBe(true)
  })

  const adminEmail = process.env.TEST_ADMIN_EMAIL
  const adminPassword = process.env.TEST_ADMIN_PASSWORD

  it.skipIf(!adminEmail || !adminPassword)('stores uploads, serves them at the resolved URL and deletes them with their item', async () => {
    const result = await client.action(api.auth.signIn, { provider: 'password', params: { email: adminEmail!, password: adminPassword!, flow: 'signIn' } })
    const admin = new ConvexHttpClient(url)
    admin.setAuth(result.tokens!.token)

    // A 1×1 transparent WebP.
    const webp = Uint8Array.from(atob('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='), (c) => c.charCodeAt(0))
    const upload = await fetch(await admin.mutation(api.media.generateUploadUrl, {}), { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: webp })
    const { storageId } = (await upload.json()) as { storageId: Id<'_storage'> }
    const stored = await admin.mutation(api.media.finalizeUpload, { storageId, kind: 'image' })

    expect(stored.path).toBe(storageId)
    expect((await fetch(stored.url)).status).toBe(200)

    // Documents keep the storage id; queries hand the site a working URL.
    const itemId = await admin.mutation(api.content.saveGalleryItem, {
      id: null, mediaType: 'image', mediaPath: stored.path, posterPath: null, beforePath: null, caption: '',
      altText: 'Integration test image', category: 'styling', source: 'salon', width: 1, height: 1, isFeatured: false, isPublished: false,
    })
    const item = (await admin.query(api.content.listGallery, {})).find((i) => i._id === itemId)!
    expect(item.mediaPath).toBe(storageId)
    expect((await fetch(item.mediaUrl!)).status).toBe(200)
    expect((await client.query(api.public.gallery, {})).some((i) => i._id === itemId)).toBe(false) // unpublished

    await admin.mutation(api.content.deleteGalleryItem, { id: itemId })
    expect((await fetch(stored.url)).status).toBe(404)

    // A file of the wrong type is rejected and deleted.
    const bad = await fetch(await admin.mutation(api.media.generateUploadUrl, {}), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello' })
    const { storageId: badId } = (await bad.json()) as { storageId: Id<'_storage'> }
    expect(await codeOf(admin.mutation(api.media.finalizeUpload, { storageId: badId, kind: 'image' }))).toBe('INVALID_UPLOAD')
  })
})
