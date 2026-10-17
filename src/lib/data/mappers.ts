/** Database rows (snake_case) → domain objects (camelCase). */
import type {
  BusinessHours,
  BusinessSettings,
  CustomerBooking,
  GalleryItem,
  Review,
  Service,
  ServiceCategory,
  Socials,
  Stylist,
} from '@/lib/types'

type Row = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null)
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
const hhmm = (v: unknown) => (typeof v === 'string' ? v.slice(0, 5) : null)

export function mapSettings(r: Row): BusinessSettings {
  return {
    name: String(r.name),
    tagline: str(r.tagline),
    phone: str(r.phone),
    whatsapp: str(r.whatsapp),
    email: str(r.email),
    addressLine: str(r.address_line),
    city: String(r.city ?? 'Addis Ababa'),
    countryCode: String(r.country_code ?? 'ET'),
    mapUrl: str(r.map_url),
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    socials: cleanSocials(r.socials),
    aboutStory: str(r.about_story),
    policyText: str(r.policy_text),
    onlineBookingEnabled: Boolean(r.online_booking_enabled),
    minLeadMinutes: Number(r.min_lead_minutes),
    maxAdvanceDays: Number(r.max_advance_days),
    slotIntervalMin: Number(r.slot_interval_min),
    defaultBufferMin: Number(r.default_buffer_min),
    cancelCutoffHours: Number(r.cancel_cutoff_hours),
    allowCustomerCancel: Boolean(r.allow_customer_cancel),
    allowCustomerReschedule: Boolean(r.allow_customer_reschedule),
    autoConfirm: Boolean(r.auto_confirm),
    requireEmail: Boolean(r.require_email),
  }
}

const SOCIAL_KEYS = ['instagram', 'facebook', 'tiktok', 'youtube', 'telegram'] as const

/** Keep only known networks with https URLs. */
export function cleanSocials(value: unknown): Socials {
  const out: Socials = {}
  if (!value || typeof value !== 'object') return out
  for (const key of SOCIAL_KEYS) {
    const url = (value as Record<string, unknown>)[key]
    if (typeof url === 'string' && url.startsWith('https://')) out[key] = url
  }
  return out
}

export function mapHours(r: Row): BusinessHours {
  return { weekday: Number(r.weekday), isClosed: Boolean(r.is_closed), opensAt: hhmm(r.opens_at), closesAt: hhmm(r.closes_at) }
}

export function mapCategory(r: Row): ServiceCategory {
  return { id: String(r.id), slug: String(r.slug), name: String(r.name), description: str(r.description), sortOrder: Number(r.sort_order ?? 0) }
}

export function mapService(r: Row): Service {
  const category = r.category as Row | null | undefined
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    summary: str(r.summary),
    description: str(r.description),
    imagePath: str(r.image_path),
    priceEtb: Number(r.price_etb),
    priceType: r.price_type === 'from' ? 'from' : 'fixed',
    durationMin: Number(r.duration_min),
    bufferMin: num(r.buffer_min),
    isActive: Boolean(r.is_active),
    isFeatured: Boolean(r.is_featured),
    sortOrder: Number(r.sort_order ?? 0),
    isDemo: Boolean(r.is_demo),
    category: category ? { id: String(category.id), slug: String(category.slug), name: String(category.name) } : null,
  }
}

export function mapStylist(r: Row): Stylist {
  const links = (r.stylist_services as Row[] | undefined) ?? []
  return {
    id: String(r.id),
    slug: String(r.slug),
    displayName: String(r.display_name),
    title: str(r.title),
    bio: str(r.bio),
    photoPath: str(r.photo_path),
    isActive: Boolean(r.is_active),
    acceptsOnlineBooking: Boolean(r.accepts_online_booking),
    sortOrder: Number(r.sort_order ?? 0),
    isDemo: Boolean(r.is_demo),
    serviceIds: links.map((l) => String(l.service_id)),
  }
}

export function mapGalleryItem(r: Row): GalleryItem {
  return {
    id: String(r.id),
    mediaType: r.media_type === 'video' ? 'video' : 'image',
    mediaPath: String(r.media_path),
    posterPath: str(r.poster_path),
    beforePath: str(r.before_path),
    caption: str(r.caption),
    altText: String(r.alt_text),
    category: String(r.category),
    source: r.source === 'illustrative' ? 'illustrative' : 'salon',
    width: num(r.width),
    height: num(r.height),
    isFeatured: Boolean(r.is_featured),
    isPublished: Boolean(r.is_published),
    sortOrder: Number(r.sort_order ?? 0),
  }
}

export function mapReview(r: Row): Review {
  return {
    id: String(r.id),
    authorName: String(r.author_name),
    rating: num(r.rating),
    body: String(r.body),
    source: r.source as Review['source'],
    sourceUrl: str(r.source_url),
    reviewedOn: str(r.reviewed_on),
  }
}

export function mapCustomerBooking(r: Row): CustomerBooking {
  return {
    reference: String(r.reference),
    status: r.status as CustomerBooking['status'],
    serviceId: String(r.service_id),
    serviceName: String(r.service_name),
    stylistName: str(r.stylist_name),
    startsAt: String(r.starts_at),
    endsAt: String(r.ends_at),
    durationMin: Number(r.duration_min),
    priceEtb: Number(r.price_etb),
    priceType: r.price_type === 'from' ? 'from' : 'fixed',
    customerName: String(r.customer_name),
    canCancel: Boolean(r.can_cancel),
    canReschedule: Boolean(r.can_reschedule),
    changeDeadline: String(r.change_deadline),
  }
}
