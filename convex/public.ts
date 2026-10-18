/**
 * Published content for the public website. Anyone may call these; they return
 * only what the site shows (active catalogue, published gallery and reviews,
 * public settings) and never private fields such as stylist contacts. Media
 * references come with displayable URLs (imageUrl, photoUrl, mediaUrl…).
 */
import { v } from 'convex/values'
import { query } from './_generated/server'
import { galleryItemWithUrls, resolveMedia, withGalleryUrls } from './lib/media'
import schema from './schema'

export const settings = query({
  args: {},
  returns: v.union(schema.doc('businessSettings'), v.null()),
  handler: async (ctx) => await ctx.db.query('businessSettings').first(),
})

export const businessHours = query({
  args: {},
  returns: v.array(schema.doc('businessHours')),
  handler: async (ctx) => await ctx.db.query('businessHours').withIndex('by_weekday').take(7),
})

export const categories = query({
  args: {},
  returns: v.array(schema.doc('serviceCategories')),
  handler: async (ctx) => {
    const rows = await ctx.db.query('serviceCategories').withIndex('by_sortOrder').take(200)
    return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  },
})

const publicService = v.object({
  ...schema.doc('services').fields,
  imageUrl: v.optional(v.string()),
  category: v.union(v.object({ _id: v.id('serviceCategories'), slug: v.string(), name: v.string() }), v.null()),
})

/** Active services, ordered for display, each with its category. */
export const services = query({
  args: {},
  returns: v.array(publicService),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('services')
      .withIndex('by_isActive_and_sortOrder', (q) => q.eq('isActive', true))
      .take(500)
    rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    return await Promise.all(
      rows.map(async (s) => {
        const c = s.categoryId ? await ctx.db.get('serviceCategories', s.categoryId) : null
        return { ...s, imageUrl: await resolveMedia(ctx, s.imagePath), category: c ? { _id: c._id, slug: c.slug, name: c.name } : null }
      }),
    )
  },
})

/** Active stylists with the services each performs. */
export const stylists = query({
  args: {},
  returns: v.array(v.object({ ...schema.doc('stylists').fields, photoUrl: v.optional(v.string()), serviceIds: v.array(v.id('services')) })),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('stylists')
      .withIndex('by_isActive_and_sortOrder', (q) => q.eq('isActive', true))
      .take(200)
    return await Promise.all(
      rows.map(async (s) => {
        const links = await ctx.db
          .query('stylistServices')
          .withIndex('by_stylistId_and_serviceId', (q) => q.eq('stylistId', s._id))
          .take(500)
        return { ...s, photoUrl: await resolveMedia(ctx, s.photoPath), serviceIds: links.map((l) => l.serviceId) }
      }),
    )
  },
})

/** Published items whose files are all available, in display order. */
export const gallery = query({
  args: {},
  returns: v.array(galleryItemWithUrls),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('galleryItems')
      .withIndex('by_isPublished_and_sortOrder', (q) => q.eq('isPublished', true))
      .take(500)
    const items = await Promise.all(rows.map((item) => withGalleryUrls(ctx, item)))
    return items.filter((i) => i.mediaUrl && (i.mediaType === 'image' || i.posterUrl) && (!i.beforePath || i.beforeUrl))
  },
})

/** Published, verified reviews only. */
export const reviews = query({
  args: {},
  returns: v.array(schema.doc('reviews')),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('reviews')
      .withIndex('by_isPublished_and_sortOrder', (q) => q.eq('isPublished', true))
      .take(200)
    return rows.sort((a, b) => a.sortOrder - b.sortOrder || (b.reviewedOn ?? '').localeCompare(a.reviewedOn ?? ''))
  },
})
