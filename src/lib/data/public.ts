import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { isDemoContentEnabled } from '@/lib/env'
import { createPublicClient } from '@/lib/supabase/public'
import type { BusinessHours, BusinessSettings, GalleryItem, Review, Service, ServiceCategory, Stylist } from '@/lib/types'
import { demoCategories, demoServices, demoStylists, fallbackGallery, fallbackHours, fallbackSettings } from './fallback'
import { mapCategory, mapGalleryItem, mapHours, mapReview, mapService, mapSettings, mapStylist } from './mappers'
import { TAGS } from './tags'

/*
 * Cached reads for the public site. Each is tagged so dashboard edits can
 * refresh exactly what changed. Reads that fail fall back to verified static
 * content, cached briefly so a transient outage heals itself within minutes.
 */

const SERVICE_COLUMNS =
  'id, slug, name, summary, description, image_path, price_etb, price_type, duration_min, buffer_min, is_active, is_featured, sort_order, is_demo, category:service_categories(id, slug, name)'

const STYLIST_COLUMNS =
  'id, slug, display_name, title, bio, photo_path, is_active, accepts_online_booking, sort_order, is_demo, stylist_services(service_id)'

export async function getSettings(): Promise<BusinessSettings> {
  'use cache'
  cacheTag(TAGS.settings)
  const sb = createPublicClient()
  if (!sb) {
    cacheLife('max')
    return fallbackSettings
  }
  const { data, error } = await sb.from('business_settings').select('*').eq('id', 1).maybeSingle()
  if (error || !data) {
    console.error('[data] settings unavailable, using verified fallback', error?.message)
    cacheLife('minutes')
    return fallbackSettings
  }
  cacheLife('hours')
  return mapSettings(data)
}

export async function getBusinessHours(): Promise<BusinessHours[]> {
  'use cache'
  cacheTag(TAGS.settings)
  const sb = createPublicClient()
  if (!sb) {
    cacheLife('max')
    return fallbackHours
  }
  const { data, error } = await sb.from('business_hours').select('*').order('weekday')
  if (error || !data?.length) {
    console.error('[data] hours unavailable, using verified fallback', error?.message)
    cacheLife('minutes')
    return fallbackHours
  }
  cacheLife('hours')
  return data.map(mapHours)
}

export async function getCategories(): Promise<ServiceCategory[]> {
  'use cache'
  cacheTag(TAGS.catalog)
  const sb = createPublicClient()
  if (!sb) {
    cacheLife('max')
    return isDemoContentEnabled ? demoCategories : []
  }
  const { data, error } = await sb.from('service_categories').select('*').order('sort_order').order('name')
  if (error) {
    console.error('[data] categories unavailable', error.message)
    cacheLife('minutes')
    return []
  }
  cacheLife('hours')
  return data.map(mapCategory)
}

/** Active services, ordered for display. */
export async function getServices(): Promise<Service[]> {
  'use cache'
  cacheTag(TAGS.catalog)
  const sb = createPublicClient()
  if (!sb) {
    cacheLife('max')
    return isDemoContentEnabled ? demoServices : []
  }
  const { data, error } = await sb
    .from('services')
    .select(SERVICE_COLUMNS)
    .eq('is_active', true)
    .order('sort_order')
    .order('name')
  if (error) {
    console.error('[data] services unavailable', error.message)
    cacheLife('minutes')
    return []
  }
  cacheLife('hours')
  return data.map((row) => mapService(row as Record<string, unknown>))
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const services = await getServices()
  return services.find((s) => s.slug === slug) ?? null
}

/** Active stylists with the services each performs. */
export async function getStylists(): Promise<Stylist[]> {
  'use cache'
  cacheTag(TAGS.team)
  const sb = createPublicClient()
  if (!sb) {
    cacheLife('max')
    return isDemoContentEnabled ? demoStylists : []
  }
  const { data, error } = await sb.from('stylists').select(STYLIST_COLUMNS).eq('is_active', true).order('sort_order')
  if (error) {
    console.error('[data] stylists unavailable', error.message)
    cacheLife('minutes')
    return []
  }
  cacheLife('hours')
  return data.map((row) => mapStylist(row as Record<string, unknown>))
}

export async function getGallery(): Promise<GalleryItem[]> {
  'use cache'
  cacheTag(TAGS.gallery)
  const sb = createPublicClient()
  if (!sb) {
    cacheLife('max')
    return fallbackGallery
  }
  const { data, error } = await sb
    .from('gallery_items')
    .select('*')
    .eq('is_published', true)
    .order('sort_order')
    .order('created_at')
  if (error) {
    console.error('[data] gallery unavailable, using bundled salon photography', error.message)
    cacheLife('minutes')
    return fallbackGallery
  }
  cacheLife('hours')
  return data.map(mapGalleryItem)
}

/** Published, verified reviews only — none are bundled with the site. */
export async function getReviews(): Promise<Review[]> {
  'use cache'
  cacheTag(TAGS.reviews)
  const sb = createPublicClient()
  if (!sb) {
    cacheLife('max')
    return []
  }
  const { data, error } = await sb
    .from('reviews')
    .select('*')
    .eq('is_published', true)
    .order('sort_order')
    .order('reviewed_on', { ascending: false })
  if (error) {
    console.error('[data] reviews unavailable', error.message)
    cacheLife('minutes')
    return []
  }
  cacheLife('hours')
  return data.map(mapReview)
}
