'use server'

import { refresh, updateTag } from 'next/cache'
import { z } from 'zod'
import { ADMIN_ONLY, authorize, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { TAGS } from '@/lib/data/tags'
import { createSessionClient } from '@/lib/supabase/server'

const review = z.object({
  id: z.uuid().nullable(),
  authorName: z.string().trim().min(1, 'Enter the reviewer’s name as published.').max(80),
  rating: z.number().int().min(1).max(5).nullable(),
  body: z.string().trim().min(1, 'Paste the review text.').max(2000),
  source: z.enum(['google', 'tripadvisor', 'facebook', 'instagram', 'in_person', 'other']),
  sourceUrl: z.string().trim().refine((v) => v === '' || /^https:\/\//.test(v), 'Links must start with https://'),
  reviewedOn: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  isPublished: z.boolean(),
})

export async function saveReview(values: z.input<typeof review>): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = review.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  const row = {
    author_name: v.authorName,
    rating: v.rating,
    body: v.body,
    source: v.source,
    source_url: v.sourceUrl || null,
    reviewed_on: v.reviewedOn || null,
    is_published: v.isPublished,
  }
  const db = await createSessionClient()
  const { error } = v.id ? await db.from('reviews').update(row).eq('id', v.id) : await db.from('reviews').insert(row)
  if (error) return { ok: false, error: toAppError(error).message }
  updateTag(TAGS.reviews)
  refresh()
  return { ok: true, message: 'Review saved.' }
}

export async function deleteReview(id: string): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const db = await createSessionClient()
  const { error } = await db.from('reviews').delete().eq('id', id)
  if (error) return { ok: false, error: toAppError(error).message }
  updateTag(TAGS.reviews)
  refresh()
  return { ok: true, message: 'Review deleted.' }
}
