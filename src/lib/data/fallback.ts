/**
 * Content used when the database is not configured.
 *
 * - Verified settings, hours and genuine salon photography are always safe to
 *   show (they mirror supabase/migrations/…_seed_verified_content.sql).
 * - Demo services and stylists appear only when DEMO_CONTENT=true outside
 *   production, and every one of them is labelled as demo content.
 */
import { verifiedBusiness, verifiedHours } from '@/config/site'
import type { BusinessHours, BusinessSettings, GalleryItem, Service, ServiceCategory, Stylist } from '@/lib/types'

export const fallbackSettings: BusinessSettings = {
  name: verifiedBusiness.name,
  tagline: verifiedBusiness.tagline,
  phone: verifiedBusiness.phone,
  whatsapp: null,
  email: null,
  addressLine: verifiedBusiness.addressLine,
  city: verifiedBusiness.city,
  countryCode: verifiedBusiness.countryCode,
  mapUrl: null,
  latitude: null,
  longitude: null,
  socials: {},
  aboutStory: null,
  policyText:
    'Online bookings are requests until our team confirms them. Please arrive a few minutes early. ' +
    'If you need to cancel or move your appointment, please do so at least 12 hours beforehand using your ' +
    'booking reference, or call us. Payment is taken at the salon.',
  // Without a database there is nothing to book against.
  onlineBookingEnabled: false,
  minLeadMinutes: 120,
  maxAdvanceDays: 60,
  slotIntervalMin: 15,
  defaultBufferMin: 10,
  cancelCutoffHours: 12,
  allowCustomerCancel: true,
  allowCustomerReschedule: true,
  autoConfirm: false,
  requireEmail: false,
}

export const fallbackHours: BusinessHours[] = verifiedHours.map((h) => ({
  weekday: h.weekday,
  isClosed: h.isClosed,
  opensAt: h.opensAt,
  closesAt: h.closesAt,
}))

const photo = (
  id: string, file: string, caption: string, altText: string, category: string,
  width: number, height: number, isFeatured: boolean, sortOrder: number,
): GalleryItem => ({
  id, mediaType: 'image', mediaPath: `/images/gallery/${file}`, posterPath: null, beforePath: null,
  caption, altText, category, source: 'salon', width, height, isFeatured, isPublished: true, sortOrder,
})

const reel = (id: string, name: string, caption: string, altText: string, category: string, sortOrder: number): GalleryItem => ({
  id, mediaType: 'video', mediaPath: `/videos/gallery/${name}.mp4`, posterPath: `/videos/gallery/${name}-poster.jpg`,
  beforePath: null, caption, altText, category, source: 'salon', width: 540, height: 960,
  isFeatured: false, isPublished: true, sortOrder,
})

export const fallbackGallery: GalleryItem[] = [
  photo('g-copper-twists', 'copper-passion-twists.jpg', 'Copper passion twists',
    'Back view of long two-tone passion twists, black at the root fading to copper, in the Orange Salon lounge',
    'braids', 962, 1454, true, 10),
  photo('g-burgundy', 'burgundy-waves-highlights.jpg', 'Burgundy waves with face-framing highlights',
    'Client with shoulder-length burgundy waves and silver face-framing highlights', 'colour', 724, 1600, true, 20),
  photo('g-stitch', 'stitch-braids-curly-ponytail.jpg', 'Stitch braids into a curly ponytail',
    'Side view of neat stitch braids swept into a voluminous curly ponytail', 'braids', 1500, 2000, true, 30),
  photo('g-spiral', 'blonde-spiral-curls.jpg', 'Spiral curls with blonde highlights',
    'Back view of defined spiral curls through highlighted blonde hair', 'styling', 1024, 1536, true, 40),
  photo('g-balayage', 'balayage-waves.jpg', 'Soft balayage waves',
    'Back view of a shoulder-length cut with honey balayage and soft waves', 'colour', 1024, 1536, false, 50),
  photo('g-twists', 'two-strand-twists.jpg', 'Two-strand twists',
    'Top-down view of two-strand twists with clean triangular parts', 'braids', 1086, 1448, false, 60),
  photo('g-neon', 'burgundy-waves-neon-sign.jpg', 'Burgundy colour under the Orange Salon sign',
    'Client with burgundy waves seated in front of the illuminated Orange Salon neon sign', 'colour', 960, 1600, false, 70),
  photo('g-at-work', 'stylist-at-work.jpg', 'In the chair at Orange Salon',
    "Stylist smiling while styling a client's long straight hair inside Orange Salon", 'styling', 1510, 1536, false, 80),
  reel('g-copper-bob', 'copper-bob-colour', 'Copper bob colour',
    'Short video of a glossy copper-red bob being shown from different angles', 'colour', 90),
  reel('g-knotless', 'knotless-braids-two-tone', 'Two-tone knotless braids',
    'Short video of shoulder-length knotless braids in black and honey blonde', 'braids', 100),
  reel('g-cornrows', 'cornrows-with-natural-volume', 'Cornrows with natural volume',
    'Short video of fine front cornrows leading into full natural curls', 'braids', 110),
]

// ── Demo content (DEMO_CONTENT=true, never production) ─────────────────────
/** Stable, UUID-shaped ids for demo rows (the API only accepts UUIDs). */
function demoUuid(seed: string): string {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  const hex = (h.toString(16).padStart(8, '0') + seed.length.toString(16).padStart(4, '0')).slice(0, 12)
  return `00000000-0000-4000-8000-${hex}`
}

const demoCategory = (slug: string, name: string, sortOrder: number): ServiceCategory => ({
  id: demoUuid(`cat-${slug}`), slug, name, description: null, sortOrder,
})

export const demoCategories: ServiceCategory[] = [
  demoCategory('braids', 'Braids & Protective Styles', 10),
  demoCategory('colour', 'Colour', 20),
  demoCategory('cuts-styling', 'Cuts & Styling', 30),
]

const demoService = (
  slug: string, name: string, summary: string, cat: ServiceCategory, imagePath: string | null,
  priceEtb: number, priceType: 'fixed' | 'from', durationMin: number, isFeatured: boolean, sortOrder: number,
): Service => ({
  id: demoUuid(`svc-${slug}`), slug, name, summary,
  description: 'Illustrative demo service. The real menu, prices and timings are set by the salon in the dashboard.',
  imagePath, priceEtb, priceType, durationMin, bufferMin: 15, isActive: true, isFeatured, sortOrder, isDemo: true,
  category: { id: cat.id, slug: cat.slug, name: cat.name },
})

const [braids, colour, styling] = demoCategories

export const demoServices: Service[] = [
  demoService('demo-knotless-braids', 'Knotless Braids', 'Lightweight, natural-looking braids.', braids,
    '/images/gallery/copper-passion-twists.jpg', 4500, 'from', 240, true, 10),
  demoService('demo-stitch-braids', 'Stitch Braids', 'Clean, defined cornrow patterns.', braids,
    '/images/gallery/stitch-braids-curly-ponytail.jpg', 3000, 'from', 150, true, 20),
  demoService('demo-colour-highlights', 'Colour & Highlights', 'Dimensional colour, tailored to you.', colour,
    '/images/gallery/burgundy-waves-highlights.jpg', 3500, 'from', 180, true, 30),
  demoService('demo-balayage', 'Balayage', 'Soft, sun-kissed colour.', colour,
    '/images/gallery/balayage-waves.jpg', 5000, 'from', 210, true, 40),
  demoService('demo-curls-styling', 'Curls & Styling', 'Defined curls for any occasion.', styling,
    '/images/gallery/blonde-spiral-curls.jpg', 1200, 'fixed', 75, true, 50),
  demoService('demo-silk-press', 'Silk Press', 'Smooth, glossy and swingy.', styling,
    '/images/gallery/stylist-at-work.jpg', 1500, 'fixed', 90, true, 60),
]

export const demoStylists: Stylist[] = [1, 2, 3].map((n) => ({
  id: demoUuid(`stylist-${n}`),
  slug: `demo-stylist-${n}`,
  displayName: `Stylist ${['One', 'Two', 'Three'][n - 1]}`,
  title: ['Braids specialist', 'Colour specialist', 'Stylist'][n - 1],
  bio: 'Placeholder profile for development.',
  photoPath: null,
  isActive: true,
  acceptsOnlineBooking: true,
  sortOrder: n,
  isDemo: true,
  serviceIds: demoServices.map((s) => s.id),
}))
