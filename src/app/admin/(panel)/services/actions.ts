'use server'

import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { refresh, updateTag } from 'next/cache'
import { z } from 'zod'
import { ADMIN_ONLY, authorize, type ActionResult } from '@/lib/auth/staff'
import { errorCode, toAppError } from '@/lib/booking/errors'
import { staffMutation } from '@/lib/convex/server'
import { TAGS } from '@/lib/data/tags'
import { MEDIA_PATH_PATTERN, slugify } from '@/lib/slug'
import { convexId } from '@/lib/validation'

const serviceInput = z.object({
  id: convexId().nullable(),
  name: z.string().trim().min(1, 'Enter a name.').max(120),
  slug: z.string().trim().max(80).optional(),
  categoryId: convexId().nullable(),
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
  let id: string
  try {
    id = await staffMutation(api.catalog.saveService, {
      ...v,
      slug,
      id: v.id as Id<'services'> | null,
      categoryId: v.categoryId as Id<'serviceCategories'> | null,
    })
  } catch (error) {
    if (errorCode(error) === 'SLUG_TAKEN') return { ok: false, error: 'Another service already uses this web address (slug).', fields: { slug: 'Already in use.' } }
    return { ok: false, error: toAppError(error).message }
  }
  updateTag(TAGS.catalog)
  refresh()
  return { ok: true, message: 'Service saved.', data: { id } }
}

export async function deleteService(id: string): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  try {
    await staffMutation(api.catalog.deleteService, { id: id as Id<'services'> })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  updateTag(TAGS.catalog)
  refresh()
  return { ok: true, message: 'Service deleted.' }
}

const categoryInput = z.object({
  id: convexId().nullable(),
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
  try {
    await staffMutation(api.catalog.saveCategory, { ...v, id: v.id as Id<'serviceCategories'> | null, slug: slugify(v.name) })
  } catch (error) {
    return { ok: false, error: errorCode(error) === 'SLUG_TAKEN' ? 'A category with this name already exists.' : toAppError(error).message }
  }
  updateTag(TAGS.catalog)
  refresh()
  return { ok: true, message: 'Category saved.' }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  try {
    await staffMutation(api.catalog.deleteCategory, { id: id as Id<'serviceCategories'> })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  updateTag(TAGS.catalog)
  refresh()
  return { ok: true, message: 'Category removed. Its services are now uncategorised.' }
}
