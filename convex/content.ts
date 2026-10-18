/** Gallery, reviews and contact messages. */
import { v } from 'convex/values'
import { ADMIN_ONLY, FRONT_DESK, serverMutation, staffMutation, staffQuery } from './lib/access'
import { fail } from './lib/errors'
import { checkMediaPath, deleteStored, galleryItemWithUrls, withGalleryUrls } from './lib/media'
import { EMAIL, ISO_DATE, optionalHttps, PHONE_E164, SLUG, text } from './lib/validate'
import { galleryMediaTypeValidator, gallerySourceValidator, reviewSourceValidator } from './lib/validators'
import schema from './schema'

// ── Gallery ──────────────────────────────────────────────────────────────────
export const listGallery = staffQuery({
  args: {},
  returns: v.array(galleryItemWithUrls),
  handler: async (ctx) => {
    const rows = await ctx.db.query('galleryItems').withIndex('by_sortOrder').take(1000)
    return await Promise.all(rows.map((item) => withGalleryUrls(ctx, item)))
  },
})

export const saveGalleryItem = staffMutation({
  roles: ADMIN_ONLY,
  args: {
    id: v.union(v.id('galleryItems'), v.null()),
    mediaType: galleryMediaTypeValidator,
    mediaPath: v.string(),
    posterPath: v.union(v.string(), v.null()),
    beforePath: v.union(v.string(), v.null()),
    caption: v.string(),
    altText: v.string(),
    category: v.string(),
    source: gallerySourceValidator,
    width: v.union(v.number(), v.null()),
    height: v.union(v.number(), v.null()),
    isFeatured: v.boolean(),
    isPublished: v.boolean(),
  },
  returns: v.id('galleryItems'),
  handler: async (ctx, a) => {
    if (a.mediaType === 'video' && !a.posterPath) fail('POSTER_REQUIRED')
    // A before/after pair must be two genuine photographs.
    if (a.beforePath && a.mediaType !== 'image') fail('INVALID_INPUT', 'beforePath')
    if (!SLUG.test(a.category)) fail('INVALID_INPUT', 'category')
    const dimension = (field: string, value: number | null) => {
      if (value === null) return undefined
      if (!Number.isInteger(value) || value <= 0) fail('INVALID_INPUT', field)
      return value
    }
    const row = {
      mediaType: a.mediaType,
      mediaPath: await checkMediaPath(ctx, 'mediaPath', a.mediaPath),
      posterPath: a.posterPath ? await checkMediaPath(ctx, 'posterPath', a.posterPath) : undefined,
      beforePath: a.beforePath ? await checkMediaPath(ctx, 'beforePath', a.beforePath) : undefined,
      caption: text('caption', a.caption, { max: 200 }),
      altText: text('altText', a.altText, { min: 3, max: 300, required: true }),
      category: a.category,
      source: a.source,
      width: dimension('width', a.width),
      height: dimension('height', a.height),
      isFeatured: a.isFeatured,
      isPublished: a.isPublished,
      updatedAt: Date.now(),
    }
    if (a.id) {
      if (!(await ctx.db.get('galleryItems', a.id))) fail('NOT_FOUND')
      await ctx.db.patch('galleryItems', a.id, row)
      return a.id
    }
    const last = await ctx.db.query('galleryItems').withIndex('by_sortOrder').order('desc').first()
    return await ctx.db.insert('galleryItems', { ...row, sortOrder: (last?.sortOrder ?? 0) + 10 })
  },
})

/** Removes the item and its uploaded files (bundled /public assets are left alone). */
export const deleteGalleryItem = staffMutation({
  roles: ADMIN_ONLY,
  args: { id: v.id('galleryItems') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const row = (await ctx.db.get('galleryItems', id)) ?? fail('NOT_FOUND')
    await ctx.db.delete('galleryItems', id)
    await deleteStored(ctx, [row.mediaPath, row.posterPath, row.beforePath])
    return null
  },
})

export const reorderGallery = staffMutation({
  roles: ADMIN_ONLY,
  args: { ids: v.array(v.id('galleryItems')) },
  returns: v.null(),
  handler: async (ctx, { ids }) => {
    if (ids.length > 1000) fail('INVALID_INPUT', 'ids')
    for (const [index, id] of ids.entries()) {
      const item = await ctx.db.get('galleryItems', id)
      if (item && item.sortOrder !== index + 1) await ctx.db.patch('galleryItems', id, { sortOrder: index + 1, updatedAt: Date.now() })
    }
    return null
  },
})

// ── Reviews ──────────────────────────────────────────────────────────────────
export const listReviews = staffQuery({
  args: {},
  returns: v.array(schema.doc('reviews')),
  handler: async (ctx) => {
    const rows = await ctx.db.query('reviews').withIndex('by_sortOrder').take(500)
    return rows.sort((a, b) => a.sortOrder - b.sortOrder || b._creationTime - a._creationTime)
  },
})

export const saveReview = staffMutation({
  roles: ADMIN_ONLY,
  args: {
    id: v.union(v.id('reviews'), v.null()),
    authorName: v.string(),
    rating: v.union(v.number(), v.null()),
    body: v.string(),
    source: reviewSourceValidator,
    sourceUrl: v.string(),
    reviewedOn: v.string(),
    isPublished: v.boolean(),
  },
  returns: v.id('reviews'),
  handler: async (ctx, a) => {
    if (a.rating !== null && (!Number.isInteger(a.rating) || a.rating < 1 || a.rating > 5)) fail('INVALID_INPUT', 'rating')
    if (a.reviewedOn !== '' && !ISO_DATE.test(a.reviewedOn)) fail('INVALID_INPUT', 'reviewedOn')
    const row = {
      authorName: text('authorName', a.authorName, { max: 80, required: true }),
      rating: a.rating ?? undefined,
      body: text('body', a.body, { max: 2000, required: true }),
      source: a.source,
      sourceUrl: optionalHttps('sourceUrl', a.sourceUrl),
      reviewedOn: a.reviewedOn || undefined,
      isPublished: a.isPublished,
      updatedAt: Date.now(),
    }
    if (a.id) {
      if (!(await ctx.db.get('reviews', a.id))) fail('NOT_FOUND')
      await ctx.db.patch('reviews', a.id, row)
      return a.id
    }
    return await ctx.db.insert('reviews', { ...row, sortOrder: 0 })
  },
})

export const deleteReview = staffMutation({
  roles: ADMIN_ONLY,
  args: { id: v.id('reviews') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await ctx.db.delete('reviews', id)
    return null
  },
})

// ── Contact messages ─────────────────────────────────────────────────────────
const messageStatus = v.union(v.literal('new'), v.literal('read'), v.literal('archived'))

/** The website's contact form (through the Next.js route, which validates and rate-limits). */
export const submitMessage = serverMutation({
  args: { fullName: v.string(), phone: v.union(v.string(), v.null()), email: v.union(v.string(), v.null()), message: v.string() },
  returns: v.id('contactMessages'),
  handler: async (ctx, a) => {
    const phone = a.phone?.trim() || undefined
    const email = a.email?.trim().toLowerCase() || undefined
    if (phone !== undefined && !PHONE_E164.test(phone)) fail('INVALID_PHONE')
    if (email !== undefined && !EMAIL.test(email)) fail('INVALID_EMAIL')
    if (!phone && !email) fail('INVALID_INPUT', 'phone')
    return await ctx.db.insert('contactMessages', {
      fullName: text('fullName', a.fullName, { min: 2, max: 120, required: true }),
      phone,
      email,
      message: text('message', a.message, { min: 5, max: 2000, required: true }),
      status: 'new',
    })
  },
})

/** The inbox (new and read messages) or the archive, newest first. */
export const listMessages = staffQuery({
  roles: FRONT_DESK,
  args: { archived: v.boolean() },
  returns: v.array(schema.doc('contactMessages')),
  handler: async (ctx, { archived }) => {
    const statuses = archived ? (['archived'] as const) : (['new', 'read'] as const)
    const lists = await Promise.all(
      statuses.map((status) => ctx.db.query('contactMessages').withIndex('by_status', (q) => q.eq('status', status)).order('desc').take(200)),
    )
    return lists.flat().sort((a, b) => b._creationTime - a._creationTime).slice(0, 200)
  },
})

export const setMessageStatus = staffMutation({
  roles: FRONT_DESK,
  args: { id: v.id('contactMessages'), status: messageStatus },
  returns: v.null(),
  handler: async (ctx, { id, status }) => {
    if (!(await ctx.db.get('contactMessages', id))) fail('NOT_FOUND')
    await ctx.db.patch('contactMessages', id, { status })
    return null
  },
})
