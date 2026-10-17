'use server'

import { refresh, updateTag } from 'next/cache'
import { z } from 'zod'
import { ADMIN_ONLY, authorize, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { TAGS } from '@/lib/data/tags'
import { MEDIA_PATH_PATTERN, slugify } from '@/lib/slug'
import { createSessionClient } from '@/lib/supabase/server'

const serviceInput = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, 'Enter a name.').max(120),
  slug: z.string().trim().max(80).optional(),
  categoryId: z.uuid().nullable(),
  summary: z.string().trim().max(200),
  description: z.string().trim().max(4000),
  imagePath: z.string().regex(MEDIA_PATH_PATTERN, 'Invalid image.').nullable(),
  priceEtb: z.number({ message: 'Enter a price in ETB.' }).int('Whole birr only.').min(0, 'Price can’t be negative.').max(1_000_000),
  priceType: z.enum(['fixed', 'from']),
  durationMin: z.number({ message: 'Enter a duration.' }).int().min(5, 'At least 5 minutes.').max(600, 'At most 10 hours.'),
  bufferMin: z.number().int().min(0).max(120).nullable(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
})

export async function saveService(values: z.input<typeof serviceInput>): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = serviceInput.safeParse(values)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue.message, fields: { [String(issue.path[0])]: issue.message } }
  }
  const v = parsed.data
  const slug = slugify(v.slug || v.name)
  if (!slug) return { ok: false, error: 'Enter a name using letters or numbers.', fields: { name: 'Enter a name using letters or numbers.' } }
  const row = {
    name: v.name,
    slug,
    category_id: v.categoryId,
    summary: v.summary || null,
    description: v.description || null,
    image_path: v.imagePath,
    price_etb: v.priceEtb,
    price_type: v.priceType,
    duration_min: v.durationMin,
    buffer_min: v.bufferMin,
    is_active: v.isActive,
    is_featured: v.isFeatured,
    sort_order: v.sortOrder,
  }
  const db = await createSessionClient()
  const result = v.id
    ? await db.from('services').update(row).eq('id', v.id).select('id').single()
    : await db.from('services').insert(row).select('id').single()
  if (result.error) {
    if (result.error.code === '23505') return { ok: false, error: 'Another service already uses this web address (slug).', fields: { slug: 'Already in use.' } }
    return { ok: false, error: toAppError(result.error).message }
  }
  updateTag(TAGS.catalog)
  refresh()
  return { ok: true, message: 'Service saved.', data: { id: result.data.id } }
}

export async function deleteService(id: string): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const db = await createSessionClient()
  const { error } = await db.from('services').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') return { ok: false, error: 'This service has bookings, so it can’t be deleted. Switch it off (inactive) instead.' }
    return { ok: false, error: toAppError(error).message }
  }
  updateTag(TAGS.catalog)
  refresh()
  return { ok: true, message: 'Service deleted.' }
}

const categoryInput = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, 'Enter a name.').max(80),
  description: z.string().trim().max(500),
  sortOrder: z.number().int().min(0).max(10_000),
})

export async function saveCategory(values: z.input<typeof categoryInput>): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = categoryInput.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  const row = { name: v.name, slug: slugify(v.name), description: v.description || null, sort_order: v.sortOrder }
  const db = await createSessionClient()
  const { error } = v.id ? await db.from('service_categories').update(row).eq('id', v.id) : await db.from('service_categories').insert(row)
  if (error) return { ok: false, error: error.code === '23505' ? 'A category with this name already exists.' : toAppError(error).message }
  updateTag(TAGS.catalog)
  refresh()
  return { ok: true, message: 'Category saved.' }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const db = await createSessionClient()
  const { error } = await db.from('service_categories').delete().eq('id', id)
  if (error) return { ok: false, error: toAppError(error).message }
  updateTag(TAGS.catalog)
  refresh()
  return { ok: true, message: 'Category removed. Its services are now uncategorised.' }
}
