'use server'

import { refresh, updateTag } from 'next/cache'
import { z } from 'zod'
import { ADMIN_ONLY, authorize, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { TAGS } from '@/lib/data/tags'
import { MEDIA_BUCKET } from '@/lib/media-url'
import { MEDIA_PATH_PATTERN } from '@/lib/slug'
import { createSessionClient } from '@/lib/supabase/server'

const item = z.object({
  id: z.uuid().nullable(),
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

  const row = {
    media_type: v.mediaType,
    media_path: v.mediaPath,
    poster_path: v.posterPath,
    before_path: v.beforePath,
    caption: v.caption || null,
    alt_text: v.altText,
    category: v.category,
    source: v.source,
    width: v.width,
    height: v.height,
    is_featured: v.isFeatured,
    is_published: v.isPublished,
  }
  const db = await createSessionClient()
  let error
  if (v.id) {
    ;({ error } = await db.from('gallery_items').update(row).eq('id', v.id))
  } else {
    const { data: last } = await db.from('gallery_items').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
    ;({ error } = await db.from('gallery_items').insert({ ...row, sort_order: (last?.sort_order ?? 0) + 10 }))
  }
  if (error) return { ok: false, error: toAppError(error).message }
  updateTag(TAGS.gallery)
  refresh()
  return { ok: true, message: v.id ? 'Saved.' : 'Added to the gallery.' }
}

export async function deleteGalleryItem(id: string): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const db = await createSessionClient()
  const { data: row } = await db.from('gallery_items').select('media_path, poster_path, before_path').eq('id', id).maybeSingle()
  const { error } = await db.from('gallery_items').delete().eq('id', id)
  if (error) return { ok: false, error: toAppError(error).message }
  // Remove uploaded files (bundled /public assets are left alone).
  const stored = [row?.media_path, row?.poster_path, row?.before_path].filter((p): p is string => Boolean(p) && !p!.startsWith('/'))
  if (stored.length) await db.storage.from(MEDIA_BUCKET).remove(stored)
  updateTag(TAGS.gallery)
  refresh()
  return { ok: true, message: 'Removed from the gallery.' }
}

export async function reorderGallery(ids: string[]): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  if (!z.array(z.uuid()).max(1000).safeParse(ids).success) return { ok: false, error: 'Invalid order.' }
  const db = await createSessionClient()
  const { error } = await db.rpc('reorder_gallery', { p_ids: ids })
  if (error) return { ok: false, error: toAppError(error).message }
  updateTag(TAGS.gallery)
  refresh()
  return { ok: true }
}
