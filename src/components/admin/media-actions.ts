'use server'

import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { ADMIN_ONLY, authorize, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { staffMutation } from '@/lib/convex/server'

/** A one-time URL the browser can POST a file to (Convex file storage). */
export async function createUploadUrl(): Promise<ActionResult<{ url: string }>> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  try {
    return { ok: true, data: { url: await staffMutation(api.media.generateUploadUrl, {}) } }
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
}

/** Checks the uploaded file's type and size (rejects are deleted); returns its stored path and URL. */
export async function finalizeUpload(storageId: string, kind: 'image' | 'video'): Promise<ActionResult<{ path: string; url: string }>> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  try {
    const stored = await staffMutation(api.media.finalizeUpload, { storageId: storageId as Id<'_storage'>, kind })
    return { ok: true, data: stored }
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
}
