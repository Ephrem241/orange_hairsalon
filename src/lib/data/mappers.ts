/**
 * Convex documents (epoch-ms instants, absent optionals) → domain objects (ISO
 * strings, nulls). Public media fields carry the displayable URL Convex resolved
 * (a site path such as "/images/…", or a file-storage URL).
 */
import type { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
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

export const iso = (ms: number) => new Date(ms).toISOString()
const orNull = <T>(v: T | undefined): T | null => (v === undefined || v === '' ? null : v)

export function mapSettings(r: Doc<'businessSettings'>): BusinessSettings {
  return {
    name: r.name,
    tagline: orNull(r.tagline),
    phone: orNull(r.phone),
    whatsapp: orNull(r.whatsapp),
    email: orNull(r.email),
    addressLine: orNull(r.addressLine),
    city: r.city,
    countryCode: r.countryCode,
    mapUrl: orNull(r.mapUrl),
    latitude: orNull(r.latitude),
    longitude: orNull(r.longitude),
    socials: cleanSocials(r.socials),
    aboutStory: orNull(r.aboutStory),
    policyText: orNull(r.policyText),
    onlineBookingEnabled: r.onlineBookingEnabled,
    minLeadMinutes: r.minLeadMinutes,
    maxAdvanceDays: r.maxAdvanceDays,
    slotIntervalMin: r.slotIntervalMin,
    defaultBufferMin: r.defaultBufferMin,
    cancelCutoffHours: r.cancelCutoffHours,
    allowCustomerCancel: r.allowCustomerCancel,
    allowCustomerReschedule: r.allowCustomerReschedule,
    autoConfirm: r.autoConfirm,
    requireEmail: r.requireEmail,
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

export function mapHours(r: Doc<'businessHours'>): BusinessHours {
  return { weekday: r.weekday, isClosed: r.isClosed, opensAt: orNull(r.opensAt), closesAt: orNull(r.closesAt) }
}

export function mapCategory(r: Doc<'serviceCategories'>): ServiceCategory {
  return { id: r._id, slug: r.slug, name: r.name, description: orNull(r.description), sortOrder: r.sortOrder }
}

export function mapService(r: FunctionReturnType<typeof api.public.services>[number]): Service {
  return {
    id: r._id,
    slug: r.slug,
    name: r.name,
    summary: orNull(r.summary),
    description: orNull(r.description),
    imagePath: orNull(r.imageUrl),
    priceEtb: r.priceEtb,
    priceType: r.priceType,
    durationMin: r.durationMin,
    bufferMin: orNull(r.bufferMin),
    isActive: r.isActive,
    isFeatured: r.isFeatured,
    sortOrder: r.sortOrder,
    isDemo: r.isDemo,
    category: r.category ? { id: r.category._id, slug: r.category.slug, name: r.category.name } : null,
  }
}

export function mapStylist(r: Doc<'stylists'> & { photoUrl?: string; serviceIds: string[] }): Stylist {
  return {
    id: r._id,
    slug: r.slug,
    displayName: r.displayName,
    title: orNull(r.title),
    bio: orNull(r.bio),
    photoPath: orNull(r.photoUrl),
    isActive: r.isActive,
    acceptsOnlineBooking: r.acceptsOnlineBooking,
    sortOrder: r.sortOrder,
    isDemo: r.isDemo,
    serviceIds: r.serviceIds,
  }
}

type GalleryRow = FunctionReturnType<typeof api.public.gallery>[number]

export function mapGalleryItem(r: GalleryRow): GalleryItem {
  return {
    id: r._id,
    mediaType: r.mediaType,
    mediaPath: r.mediaUrl ?? r.mediaPath,
    posterPath: orNull(r.posterUrl),
    beforePath: orNull(r.beforeUrl),
    caption: orNull(r.caption),
    altText: r.altText,
    category: r.category,
    source: r.source,
    width: orNull(r.width),
    height: orNull(r.height),
    isFeatured: r.isFeatured,
    isPublished: r.isPublished,
    sortOrder: r.sortOrder,
  }
}

export function mapReview(r: Doc<'reviews'>): Review {
  return {
    id: r._id,
    authorName: r.authorName,
    rating: orNull(r.rating),
    body: r.body,
    source: r.source,
    sourceUrl: orNull(r.sourceUrl),
    reviewedOn: orNull(r.reviewedOn),
  }
}

export function mapCustomerBooking(r: FunctionReturnType<typeof api.booking.cancel>['booking']): CustomerBooking {
  return {
    reference: r.reference,
    status: r.status,
    serviceId: r.serviceId,
    serviceName: r.serviceName,
    stylistName: r.stylistName,
    startsAt: iso(r.startsAt),
    endsAt: iso(r.endsAt),
    durationMin: r.durationMin,
    priceEtb: r.priceEtb,
    priceType: r.priceType,
    customerName: r.customerName,
    canCancel: r.canCancel,
    canReschedule: r.canReschedule,
    changeDeadline: iso(r.changeDeadline),
  }
}
