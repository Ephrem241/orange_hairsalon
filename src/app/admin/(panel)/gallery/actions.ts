'use server'

import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { refresh, updateTag } from 'next/cache'
import { z } from 'zod'
import { ADMIN_ONLY, authorize, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { staffMutation } from '@/lib/convex/server'
import { TAGS } from '@/lib/data/tags'
import { MEDIA_PATH_PATTERN } from '@/lib/slug'
import { convexId } from '@/lib/validation'

const item = z.object({
  id: convexId().nullable(),
  mediaType: z.enum(['image', 'video']),
  mediaPath: z.string().regex(MEDIA_PATH_PATTERN, 'Upload the image or video first.'),
  posterPath: z.string().regex(MEDIA_PATH_PATTERN).nullable(),
  beforePath: z.string().regex(MEDIA_PATH_PATTERN).nullable(),
  caption: z.string().trim().max(200),
  altText: z.string().trim().min(3, 'Describe the image for people using screen readers.').max(300),
  category: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Choose a category.'),
  source: z.enum(['salon', 'illustrative']),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
})

export async function saveGalleryItem(values: z.input<typeof item>): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = item.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  if (v.mediaType === 'video' && !v.posterPath) return { ok: false, error: 'Videos need a poster image.' }
  if (v.beforePath && v.mediaType !== 'image') return { ok: false, error: 'Before/after pairs must be photographs.' }

  try {
    await staffMutation(api.content.saveGalleryItem, { ...v, id: v.id as Id<'galleryItems'> | null })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  updateTag(TAGS.gallery)
  refresh()
  return { ok: true, message: v.id ? 'Saved.' : 'Added to the gallery.' }
}

/** Removes the item and its uploaded files (bundled /public assets are left alone). */
export async function deleteGalleryItem(id: string): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  try {
    await staffMutation(api.content.deleteGalleryItem, { id: id as Id<'galleryItems'> })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  updateTag(TAGS.gallery)
  refresh()
  return { ok: true, message: 'Removed from the gallery.' }
}

export async function reorderGallery(ids: string[]): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  if (!z.array(convexId()).max(1000).safeParse(ids).success) return { ok: false, error: 'Invalid order.' }
  try {
    await staffMutation(api.content.reorderGallery, { ids: ids as Id<'galleryItems'>[] })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  updateTag(TAGS.gallery)
  refresh()
  return { ok: true }
}
