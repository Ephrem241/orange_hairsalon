/**
 * Dashboard uploads to Convex file storage (admins only). The browser asks for
 * a one-time upload URL, POSTs the file, then finalizes it here, where type and
 * size are checked; rejected files are deleted.
 */
import { v } from 'convex/values'
import { ADMIN_ONLY, staffMutation } from './lib/access'
import { fail } from './lib/errors'
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VIDEO_TYPES } from './lib/media'

export const generateUploadUrl = staffMutation({
  roles: ADMIN_ONLY,
  args: {},
  returns: v.string(),
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
})

export const finalizeUpload = staffMutation({
  roles: ADMIN_ONLY,
  args: { storageId: v.id('_storage'), kind: v.union(v.literal('image'), v.literal('video')) },
  returns: v.object({ path: v.string(), url: v.string() }),
  handler: async (ctx, { storageId, kind }) => {
    const file = (await ctx.db.system.get('_storage', storageId)) ?? fail('NOT_FOUND')
    const allowed = kind === 'video' ? VIDEO_TYPES : IMAGE_TYPES
    const limit = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (!file.contentType || !allowed.includes(file.contentType) || file.size > limit) {
      await ctx.storage.delete(storageId)
      fail('INVALID_UPLOAD')
    }
    const url = (await ctx.storage.getUrl(storageId)) ?? fail('NOT_FOUND')
    return { path: storageId, url }
  },
})
