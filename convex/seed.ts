/**
 * Seeds. Run with the CLI (internal functions are not callable from the web):
 *
 *   npx convex run seed:verified     — production content (idempotent)
 *   npx convex run seed:sampleMenu   — the starter service menu, published as real rows
 *   npx convex run seed:demo         — DEVELOPMENT ONLY sample menu and team
 *   npx convex run seed:removeDemo   — delete everything seed:demo created
 *
 * `verified` writes only details the salon has confirmed: name, phone
 * (+251 91 241 9748), address (Ednamoll Street) and its map pin, opening
 * hours and genuine photographs and reels of work done at the salon.
 *
 * `sampleMenu` publishes the starter menu the owner chose to show while the
 * real one is prepared. Its prices are placeholders to correct in the
 * dashboard; it adds no stylists, so online booking stays closed until real
 * stylists and hours exist.
 *
 * `demo` refuses to run unless ALLOW_DEMO_SEED=true is set on the deployment
 * (`npx convex env set ALLOW_DEMO_SEED true`). Never set it on production.
 * Every row it writes is flagged isDemo and the site labels them "Demo".
 */
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { env, internalMutation, type MutationCtx } from './_generated/server'
import { fail } from './lib/errors'

const POLICY =
  'Online bookings are requests until our team confirms them. Please arrive a few minutes early. ' +
  'If you need to cancel or move your appointment, please do so at least 12 hours beforehand ' +
  'using your booking reference, or call us. Payment is taken at the salon.'

// The salon's Google Maps pin ("Orange Salon ኦሬንጅ ሳሎን"), confirmed by the owner.
const LOCATION = { mapUrl: 'https://maps.app.goo.gl/v35jnnonHKEXdFyr8', latitude: 8.9949867, longitude: 38.7851034 }

// 0 = Sunday. Mon–Sat 08:00–20:00, Sun 09:00–19:30.
const HOURS = [
  { weekday: 0, opensAt: '09:00', closesAt: '19:30' },
  ...[1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt: '08:00', closesAt: '20:00' })),
]

type GallerySeed = {
  mediaType: 'image' | 'video'
  mediaPath: string
  posterPath?: string
  caption: string
  altText: string
  category: string
  width: number
  height: number
  isFeatured: boolean
}

// Genuine salon work, shipped with the site under /public.
const GALLERY: GallerySeed[] = [
  { mediaType: 'image', mediaPath: '/images/gallery/copper-passion-twists.jpg', caption: 'Copper passion twists', altText: 'Back view of long two-tone passion twists, black at the root fading to copper, in the Orange Salon lounge', category: 'braids', width: 962, height: 1454, isFeatured: true },
  { mediaType: 'image', mediaPath: '/images/gallery/burgundy-waves-highlights.jpg', caption: 'Burgundy waves with face-framing highlights', altText: 'Client with shoulder-length burgundy waves and silver face-framing highlights', category: 'colour', width: 724, height: 1600, isFeatured: true },
  { mediaType: 'image', mediaPath: '/images/gallery/stitch-braids-curly-ponytail.jpg', caption: 'Stitch braids into a curly ponytail', altText: 'Side view of neat stitch braids swept into a voluminous curly ponytail', category: 'braids', width: 1500, height: 2000, isFeatured: true },
  { mediaType: 'image', mediaPath: '/images/gallery/blonde-spiral-curls.jpg', caption: 'Spiral curls with blonde highlights', altText: 'Back view of defined spiral curls through highlighted blonde hair', category: 'styling', width: 1024, height: 1536, isFeatured: true },
  { mediaType: 'image', mediaPath: '/images/gallery/balayage-waves.jpg', caption: 'Soft balayage waves', altText: 'Back view of a shoulder-length cut with honey balayage and soft waves', category: 'colour', width: 1024, height: 1536, isFeatured: false },
  { mediaType: 'image', mediaPath: '/images/gallery/two-strand-twists.jpg', caption: 'Two-strand twists', altText: 'Top-down view of two-strand twists with clean triangular parts', category: 'braids', width: 1086, height: 1448, isFeatured: false },
  { mediaType: 'image', mediaPath: '/images/gallery/burgundy-waves-neon-sign.jpg', caption: 'Burgundy colour under the Orange Salon sign', altText: 'Client with burgundy waves seated in front of the illuminated Orange Salon neon sign', category: 'colour', width: 960, height: 1600, isFeatured: false },
  { mediaType: 'image', mediaPath: '/images/gallery/stylist-at-work.jpg', caption: 'In the chair at Orange Salon', altText: "Stylist smiling while styling a client's long straight hair inside Orange Salon", category: 'styling', width: 1510, height: 1536, isFeatured: false },
  { mediaType: 'video', mediaPath: '/videos/gallery/copper-bob-colour.mp4', posterPath: '/videos/gallery/copper-bob-colour-poster.jpg', caption: 'Copper bob colour', altText: 'Short video of a glossy copper-red bob being shown from different angles', category: 'colour', width: 540, height: 960, isFeatured: false },
  { mediaType: 'video', mediaPath: '/videos/gallery/knotless-braids-two-tone.mp4', posterPath: '/videos/gallery/knotless-braids-two-tone-poster.jpg', caption: 'Two-tone knotless braids', altText: 'Short video of shoulder-length knotless braids in black and honey blonde', category: 'braids', width: 540, height: 960, isFeatured: false },
  { mediaType: 'video', mediaPath: '/videos/gallery/cornrows-with-natural-volume.mp4', posterPath: '/videos/gallery/cornrows-with-natural-volume-poster.jpg', caption: 'Cornrows with natural volume', altText: 'Short video of fine front cornrows leading into full natural curls', category: 'braids', width: 540, height: 960, isFeatured: false },
]

/**
 * Settings, hours and gallery. Existing rows are left untouched, except that a
 * settings document without a map location gets the verified one.
 */
export async function seedVerified(ctx: MutationCtx) {
  const now = Date.now()
  const settings = await ctx.db.query('businessSettings').first()
  if (settings) {
    const missing = {
      ...(settings.mapUrl === undefined ? { mapUrl: LOCATION.mapUrl } : {}),
      ...(settings.latitude === undefined && settings.longitude === undefined
        ? { latitude: LOCATION.latitude, longitude: LOCATION.longitude }
        : {}),
    }
    if (Object.keys(missing).length > 0) await ctx.db.patch('businessSettings', settings._id, { ...missing, updatedAt: now })
  } else {
    await ctx.db.insert('businessSettings', {
      name: 'Orange Salon',
      tagline: 'Your Hair. Your Style. Your Confidence.',
      phone: '+251912419748',
      addressLine: 'Ednamoll Street',
      city: 'Addis Ababa',
      countryCode: 'ET',
      ...LOCATION,
      socials: {},
      policyText: POLICY,
      onlineBookingEnabled: true,
      minLeadMinutes: 120,
      maxAdvanceDays: 60,
      slotIntervalMin: 15,
      defaultBufferMin: 10,
      cancelCutoffHours: 12,
      allowCustomerCancel: true,
      allowCustomerReschedule: true,
      autoConfirm: false,
      requireEmail: false,
      updatedAt: now,
    })
  }
  if (!(await ctx.db.query('notificationSettings').first())) {
    await ctx.db.insert('notificationSettings', { emailEnabled: true, whatsappEnabled: false, remindersEnabled: true, updatedAt: now })
  }
  for (const h of HOURS) {
    const existing = await ctx.db
      .query('businessHours')
      .withIndex('by_weekday', (q) => q.eq('weekday', h.weekday))
      .first()
    if (!existing) await ctx.db.insert('businessHours', { ...h, isClosed: false })
  }
  if (!(await ctx.db.query('galleryItems').first())) {
    for (const [i, item] of GALLERY.entries()) {
      await ctx.db.insert('galleryItems', { ...item, source: 'salon', isPublished: true, sortOrder: (i + 1) * 10, updatedAt: now })
    }
  }
}

export const verified = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await seedVerified(ctx)
    return null
  },
})

// ── Starter menu ─────────────────────────────────────────────────────────────
const SAMPLE_CATEGORIES = [
  { slug: 'braids', name: 'Braids & Protective Styles', description: 'Knotless braids, twists and cornrows.', sortOrder: 10 },
  { slug: 'colour', name: 'Colour', description: 'Full colour, highlights and balayage.', sortOrder: 20 },
  { slug: 'cuts-styling', name: 'Cuts & Styling', description: 'Cuts, blow-dries and finishing.', sortOrder: 30 },
  { slug: 'treatments', name: 'Treatments', description: 'Repair and moisture treatments.', sortOrder: 40 },
  { slug: 'bridal', name: 'Bridal & Events', description: 'Styling for weddings and special occasions.', sortOrder: 50 },
]

// Prices are placeholders until the owner sets the real ones in the dashboard.
const SAMPLE_SERVICES = [
  { category: 'braids', slug: 'knotless-braids', name: 'Knotless Braids', summary: 'Lightweight, natural-looking braids.', imagePath: '/images/gallery/copper-passion-twists.jpg', priceEtb: 4500, priceType: 'from', durationMin: 240, bufferMin: 15, isFeatured: true, sortOrder: 10 },
  { category: 'braids', slug: 'stitch-braids', name: 'Stitch Braids', summary: 'Clean, defined cornrow patterns.', imagePath: '/images/gallery/stitch-braids-curly-ponytail.jpg', priceEtb: 3000, priceType: 'from', durationMin: 150, bufferMin: 15, isFeatured: true, sortOrder: 20 },
  { category: 'colour', slug: 'colour-highlights', name: 'Colour & Highlights', summary: 'Dimensional colour, tailored to you.', imagePath: '/images/gallery/burgundy-waves-highlights.jpg', priceEtb: 3500, priceType: 'from', durationMin: 180, bufferMin: 15, isFeatured: true, sortOrder: 30 },
  { category: 'colour', slug: 'balayage', name: 'Balayage', summary: 'Soft, sun-kissed colour.', imagePath: '/images/gallery/balayage-waves.jpg', priceEtb: 5000, priceType: 'from', durationMin: 210, bufferMin: 15, isFeatured: false, sortOrder: 40 },
  { category: 'cuts-styling', slug: 'curls-styling', name: 'Curls & Styling', summary: 'Defined curls for any occasion.', imagePath: '/images/gallery/blonde-spiral-curls.jpg', priceEtb: 1200, priceType: 'fixed', durationMin: 75, bufferMin: 10, isFeatured: true, sortOrder: 50 },
  { category: 'cuts-styling', slug: 'silk-press', name: 'Silk Press', summary: 'Smooth, glossy and swingy.', imagePath: '/images/gallery/stylist-at-work.jpg', priceEtb: 1500, priceType: 'fixed', durationMin: 90, bufferMin: 10, isFeatured: false, sortOrder: 60 },
  { category: 'treatments', slug: 'deep-treatment', name: 'Deep Treatment', summary: 'Nourish, repair and restore.', imagePath: undefined, priceEtb: 900, priceType: 'fixed', durationMin: 45, bufferMin: 10, isFeatured: false, sortOrder: 70 },
  { category: 'bridal', slug: 'bridal-styling', name: 'Bridal Styling', summary: 'Elegant styling for your day.', imagePath: undefined, priceEtb: 6000, priceType: 'from', durationMin: 180, bufferMin: 30, isFeatured: true, sortOrder: 80 },
] as const

/**
 * Inserts the starter categories and services (skipping slugs that already
 * exist) and returns their ids by slug. A category left over from the demo
 * seed is adopted as a real one, so removeDemo never deletes it from under
 * the real menu.
 */
async function insertMenu(ctx: MutationCtx, opts: { isDemo: boolean }) {
  const now = Date.now()
  const slugOf = (slug: string) => (opts.isDemo ? `demo-${slug}` : slug)

  const categoryIds = new Map<string, Id<'serviceCategories'>>()
  for (const c of SAMPLE_CATEGORIES) {
    const existing = await ctx.db.query('serviceCategories').withIndex('by_slug', (q) => q.eq('slug', c.slug)).first()
    if (existing && existing.isDemo && !opts.isDemo) await ctx.db.patch('serviceCategories', existing._id, { isDemo: false, updatedAt: now })
    categoryIds.set(c.slug, existing?._id ?? (await ctx.db.insert('serviceCategories', { ...c, isDemo: opts.isDemo, updatedAt: now })))
  }

  const serviceIds = new Map<string, Id<'services'>>()
  for (const { category, ...s } of SAMPLE_SERVICES) {
    const slug = slugOf(s.slug)
    const existing = await ctx.db.query('services').withIndex('by_slug', (q) => q.eq('slug', slug)).first()
    serviceIds.set(
      slug,
      existing?._id ??
        (await ctx.db.insert('services', {
          ...s,
          slug,
          name: opts.isDemo ? `${s.name} (demo)` : s.name,
          categoryId: categoryIds.get(category),
          isActive: true,
          isDemo: opts.isDemo,
          updatedAt: now,
        })),
    )
  }
  return serviceIds
}

export const sampleMenu = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await insertMenu(ctx, { isDemo: false })
    return null
  },
})

// ── Development demo data ────────────────────────────────────────────────────
const DEMO_STYLISTS = [
  { slug: 'demo-stylist-one', displayName: 'Stylist One (demo)', title: 'Braids specialist', sortOrder: 10, services: ['demo-knotless-braids', 'demo-stitch-braids', 'demo-curls-styling', 'demo-bridal-styling'] },
  { slug: 'demo-stylist-two', displayName: 'Stylist Two (demo)', title: 'Colour specialist', sortOrder: 20, services: ['demo-colour-highlights', 'demo-balayage', 'demo-silk-press', 'demo-deep-treatment'] },
  { slug: 'demo-stylist-three', displayName: 'Stylist Three (demo)', title: 'Stylist', sortOrder: 30, services: SAMPLE_SERVICES.map((s) => `demo-${s.slug}`) },
]

export const demo = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (env.ALLOW_DEMO_SEED !== 'true') fail('DEMO_SEED_DISABLED')
    await seedVerified(ctx)
    const now = Date.now()
    const serviceIds = await insertMenu(ctx, { isDemo: true })

    for (const st of DEMO_STYLISTS) {
      if (await ctx.db.query('stylists').withIndex('by_slug', (q) => q.eq('slug', st.slug)).first()) continue
      const stylistId = await ctx.db.insert('stylists', {
        slug: st.slug,
        displayName: st.displayName,
        title: st.title,
        bio: 'Placeholder profile for development.',
        isActive: true,
        acceptsOnlineBooking: true,
        sortOrder: st.sortOrder,
        isDemo: true,
        updatedAt: now,
      })
      for (const slug of st.services) await ctx.db.insert('stylistServices', { stylistId, serviceId: serviceIds.get(slug)! })
      // Mon–Sat 08:00–20:00 with lunch 13:00–14:00; stylist three also works Sundays.
      for (const weekday of [1, 2, 3, 4, 5, 6]) {
        await ctx.db.insert('workingHours', { stylistId, weekday, startsAt: '08:00', endsAt: '20:00' })
        await ctx.db.insert('stylistBreaks', { stylistId, weekday, startsAt: '13:00', endsAt: '14:00', label: 'Lunch' })
      }
      if (st.slug === 'demo-stylist-three') await ctx.db.insert('workingHours', { stylistId, weekday: 0, startsAt: '09:00', endsAt: '19:30' })
    }
    return null
  },
})

/** Deletes every demo row and anything that depends on it (appointments, schedules, links). */
export const removeDemo = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const services = (await ctx.db.query('services').take(1000)).filter((s) => s.isDemo)
    const stylists = (await ctx.db.query('stylists').take(1000)).filter((s) => s.isDemo)
    const serviceIds = new Set<string>(services.map((s) => s._id))
    const stylistIds = new Set<string>(stylists.map((s) => s._id))

    for await (const a of ctx.db.query('appointments')) {
      if (a.isDemo || serviceIds.has(a.serviceId) || stylistIds.has(a.stylistId)) {
        for (const e of await ctx.db.query('appointmentEvents').withIndex('by_appointmentId', (q) => q.eq('appointmentId', a._id)).take(500)) {
          await ctx.db.delete('appointmentEvents', e._id)
        }
        for (const n of await ctx.db.query('notificationLog').withIndex('by_appointmentId', (q) => q.eq('appointmentId', a._id)).take(500)) {
          await ctx.db.delete('notificationLog', n._id)
        }
        await ctx.db.delete('appointments', a._id)
      }
    }
    for (const st of stylists) {
      const id = st._id
      for (const l of await ctx.db.query('stylistServices').withIndex('by_stylistId_and_serviceId', (q) => q.eq('stylistId', id)).take(500)) await ctx.db.delete('stylistServices', l._id)
      for (const h of await ctx.db.query('workingHours').withIndex('by_stylistId_and_weekday', (q) => q.eq('stylistId', id)).take(100)) await ctx.db.delete('workingHours', h._id)
      for (const b of await ctx.db.query('stylistBreaks').withIndex('by_stylistId_and_weekday', (q) => q.eq('stylistId', id)).take(100)) await ctx.db.delete('stylistBreaks', b._id)
      for (const t of await ctx.db.query('timeOff').withIndex('by_stylistId_and_endsAt', (q) => q.eq('stylistId', id)).take(500)) await ctx.db.delete('timeOff', t._id)
      for (const c of await ctx.db.query('stylistContacts').withIndex('by_stylistId', (q) => q.eq('stylistId', id)).take(10)) await ctx.db.delete('stylistContacts', c._id)
      for (const p of await ctx.db.query('staffProfiles').withIndex('by_stylistId', (q) => q.eq('stylistId', id)).take(10)) {
        await ctx.db.patch('staffProfiles', p._id, { stylistId: undefined, isActive: false, updatedAt: Date.now() })
      }
      await ctx.db.delete('stylists', id)
    }
    for (const s of services) {
      for (const l of await ctx.db.query('stylistServices').withIndex('by_serviceId', (q) => q.eq('serviceId', s._id)).take(500)) await ctx.db.delete('stylistServices', l._id)
      await ctx.db.delete('services', s._id)
    }
    for (const c of (await ctx.db.query('serviceCategories').take(500)).filter((c) => c.isDemo)) await ctx.db.delete('serviceCategories', c._id)
    for (const c of (await ctx.db.query('customers').take(5000)).filter((c) => c.isDemo)) await ctx.db.delete('customers', c._id)
    return null
  },
})
