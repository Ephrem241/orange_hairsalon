import 'server-only'
import { api } from '@convex/_generated/api'
import { cacheLife, cacheTag } from 'next/cache'
import { publicQuery } from '@/lib/convex/server'
import { isConvexConfigured, isDemoContentEnabled } from '@/lib/env'
import type { BusinessHours, BusinessSettings, GalleryItem, Review, Service, ServiceCategory, Stylist } from '@/lib/types'
import { demoCategories, demoServices, demoStylists, fallbackGallery, fallbackHours, fallbackSettings } from './fallback'
import { mapCategory, mapGalleryItem, mapHours, mapReview, mapService, mapSettings, mapStylist } from './mappers'
import { TAGS } from './tags'

/*
 * Cached reads for the public site. Each is tagged so dashboard edits can
 * refresh exactly what changed. Reads that fail fall back to verified static
 * content, cached briefly so a transient outage heals itself within minutes.
 */

const unavailable = (what: string, error: unknown) => console.error(`[data] ${what} unavailable`, (error as Error).message)

export async function getSettings(): Promise<BusinessSettings> {
  'use cache'
  cacheTag(TAGS.settings)
  if (!isConvexConfigured) {
    cacheLife('max')
    return fallbackSettings
  }
  try {
    const data = await publicQuery(api.public.settings, {})
    if (!data) throw new Error('no settings document (run seed:verified)')
    cacheLife('hours')
    return mapSettings(data)
  } catch (error) {
    unavailable('settings, using verified fallback;', error)
    cacheLife('minutes')
    return fallbackSettings
  }
}

export async function getBusinessHours(): Promise<BusinessHours[]> {
  'use cache'
  cacheTag(TAGS.settings)
  if (!isConvexConfigured) {
    cacheLife('max')
    return fallbackHours
  }
  try {
    const data = await publicQuery(api.public.businessHours, {})
    if (!data.length) throw new Error('no opening hours (run seed:verified)')
    cacheLife('hours')
    return data.map(mapHours)
  } catch (error) {
    unavailable('hours, using verified fallback;', error)
    cacheLife('minutes')
    return fallbackHours
  }
}

export async function getCategories(): Promise<ServiceCategory[]> {
  'use cache'
  cacheTag(TAGS.catalog)
  if (!isConvexConfigured) {
    cacheLife('max')
    return isDemoContentEnabled ? demoCategories : []
  }
  try {
    const data = await publicQuery(api.public.categories, {})
    cacheLife('hours')
    return data.map(mapCategory)
  } catch (error) {
    unavailable('categories', error)
    cacheLife('minutes')
    return []
  }
}

/** Active services, ordered for display. */
export async function getServices(): Promise<Service[]> {
  'use cache'
  cacheTag(TAGS.catalog)
  if (!isConvexConfigured) {
    cacheLife('max')
    return isDemoContentEnabled ? demoServices : []
  }
  try {
    const data = await publicQuery(api.public.services, {})
    cacheLife('hours')
    return data.map(mapService)
  } catch (error) {
    unavailable('services', error)
    cacheLife('minutes')
    return []
  }
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const services = await getServices()
  return services.find((s) => s.slug === slug) ?? null
}

/** Active stylists with the services each performs. */
export async function getStylists(): Promise<Stylist[]> {
  'use cache'
  cacheTag(TAGS.team)
  if (!isConvexConfigured) {
    cacheLife('max')
    return isDemoContentEnabled ? demoStylists : []
  }
  try {
    const data = await publicQuery(api.public.stylists, {})
    cacheLife('hours')
    return data.map(mapStylist)
  } catch (error) {
    unavailable('stylists', error)
    cacheLife('minutes')
    return []
  }
}

export async function getGallery(): Promise<GalleryItem[]> {
  'use cache'
  cacheTag(TAGS.gallery)
  if (!isConvexConfigured) {
    cacheLife('max')
    return fallbackGallery
  }
  try {
    const data = await publicQuery(api.public.gallery, {})
    cacheLife('hours')
    return data.map(mapGalleryItem)
  } catch (error) {
    unavailable('gallery, using bundled salon photography;', error)
    cacheLife('minutes')
    return fallbackGallery
  }
}

/** Published, verified reviews only — none are bundled with the site. */
export async function getReviews(): Promise<Review[]> {
  'use cache'
  cacheTag(TAGS.reviews)
  if (!isConvexConfigured) {
    cacheLife('max')
    return []
  }
  try {
    const data = await publicQuery(api.public.reviews, {})
    cacheLife('hours')
    return data.map(mapReview)
  } catch (error) {
    unavailable('reviews', error)
    cacheLife('minutes')
    return []
  }
}
