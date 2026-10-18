/**
 * Stored media references: either a Convex storage id (uploaded in the
 * dashboard) or a site-relative path ("/images/…", "/videos/…") for assets
 * shipped with the app. Queries return them resolved to displayable URLs
 * (resolveMedia); documents always keep the reference, never the URL.
 */
import { v } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { fail } from './errors'
import schema from '../schema'

const BUNDLED = /^\/(?:images|videos)\/[a-z0-9/._-]+$/

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const VIDEO_TYPES = ['video/mp4', 'video/webm']
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

export const isBundled = (path: string) => path.startsWith('/')

/** The storage id a path refers to, or null for bundled assets and unknown values. */
export function storageIdOf(ctx: QueryCtx, path: string): Id<'_storage'> | null {
  return isBundled(path) ? null : ctx.db.system.normalizeId('_storage', path)
}

/** A displayable URL for a stored reference (undefined when missing or the file is gone). */
export async function resolveMedia(ctx: QueryCtx, path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined
  if (isBundled(path)) return path
  const id = storageIdOf(ctx, path)
  return id ? ((await ctx.storage.getUrl(id)) ?? undefined) : undefined
}

/** Accepts a bundled asset path or an existing uploaded file; anything else is INVALID_INPUT. */
export async function checkMediaPath(ctx: QueryCtx, field: string, path: string): Promise<string> {
  if (BUNDLED.test(path)) return path
  const id = storageIdOf(ctx, path)
  if (!id || !(await ctx.db.system.get('_storage', id))) fail('INVALID_INPUT', field)
  return path
}

/** Delete uploaded files (bundled assets are left alone). */
export async function deleteStored(ctx: MutationCtx, paths: (string | undefined)[]) {
  for (const path of paths) {
    const id = path ? storageIdOf(ctx, path) : null
    if (id && (await ctx.db.system.get('_storage', id))) await ctx.storage.delete(id)
  }
}

export const galleryItemWithUrls = v.object({
  ...schema.doc('galleryItems').fields,
  mediaUrl: v.optional(v.string()),
  posterUrl: v.optional(v.string()),
  beforeUrl: v.optional(v.string()),
})

export async function withGalleryUrls(ctx: QueryCtx, item: Doc<'galleryItems'>) {
  const [mediaUrl, posterUrl, beforeUrl] = await Promise.all([
    resolveMedia(ctx, item.mediaPath),
    resolveMedia(ctx, item.posterPath),
    resolveMedia(ctx, item.beforePath),
  ])
  return { ...item, mediaUrl, posterUrl, beforeUrl }
}
