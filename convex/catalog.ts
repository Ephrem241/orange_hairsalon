/** Dashboard catalogue: services and categories. Staff can read; admins edit. */
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { ADMIN_ONLY, staffMutation, staffQuery } from './lib/access'
import { fail } from './lib/errors'
import { checkMediaPath, resolveMedia } from './lib/media'
import { assertSlugFree } from './lib/slugs'
import { integer, slug as checkSlug, text } from './lib/validate'
import { priceTypeValidator } from './lib/validators'
import schema from './schema'

export const listServices = staffQuery({
  args: {},
  returns: v.array(v.object({ ...schema.doc('services').fields, imageUrl: v.optional(v.string()), categoryName: v.union(v.string(), v.null()) })),
  handler: async (ctx) => {
    const rows = await ctx.db.query('services').withIndex('by_sortOrder').take(500)
    rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    const names = new Map<Id<'serviceCategories'>, string | null>()
    for (const s of rows) {
      if (s.categoryId && !names.has(s.categoryId)) names.set(s.categoryId, (await ctx.db.get('serviceCategories', s.categoryId))?.name ?? null)
    }
    return await Promise.all(
      rows.map(async (s) => ({ ...s, imageUrl: await resolveMedia(ctx, s.imagePath), categoryName: s.categoryId ? (names.get(s.categoryId) ?? null) : null })),
    )
  },
})

export const listCategories = staffQuery({
  args: {},
  returns: v.array(schema.doc('serviceCategories')),
  handler: async (ctx) => {
    const rows = await ctx.db.query('serviceCategories').withIndex('by_sortOrder').take(200)
    return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  },
})

export const saveService = staffMutation({
  roles: ADMIN_ONLY,
  args: {
    id: v.union(v.id('services'), v.null()),
    name: v.string(),
    slug: v.string(),
    categoryId: v.union(v.id('serviceCategories'), v.null()),
    summary: v.string(),
    description: v.string(),
    imagePath: v.union(v.string(), v.null()),
    priceEtb: v.number(),
    priceType: priceTypeValidator,
    durationMin: v.number(),
    bufferMin: v.union(v.number(), v.null()),
    isActive: v.boolean(),
    isFeatured: v.boolean(),
    sortOrder: v.number(),
  },
  returns: v.id('services'),
  handler: async (ctx, a) => {
    const slug = checkSlug('slug', a.slug)
    await assertSlugFree(ctx, 'services', slug, a.id)
    if (a.categoryId && !(await ctx.db.get('serviceCategories', a.categoryId))) fail('INVALID_INPUT', 'categoryId')
    const row = {
      name: text('name', a.name, { max: 120, required: true }),
      slug,
      categoryId: a.categoryId ?? undefined,
      summary: text('summary', a.summary, { max: 200 }),
      description: text('description', a.description, { max: 4000 }),
      imagePath: a.imagePath ? await checkMediaPath(ctx, 'imagePath', a.imagePath) : undefined,
      priceEtb: integer('priceEtb', a.priceEtb, 0, 1_000_000),
      priceType: a.priceType,
      durationMin: integer('durationMin', a.durationMin, 5, 600),
      bufferMin: a.bufferMin === null ? undefined : integer('bufferMin', a.bufferMin, 0, 120),
      isActive: a.isActive,
      isFeatured: a.isFeatured,
      sortOrder: integer('sortOrder', a.sortOrder, 0, 10_000),
      updatedAt: Date.now(),
    }
    if (a.id) {
      if (!(await ctx.db.get('services', a.id))) fail('NOT_FOUND')
      await ctx.db.patch('services', a.id, row)
      return a.id
    }
    return await ctx.db.insert('services', { ...row, isDemo: false })
  },
})

/** Services with booking history can't be deleted (switch them off instead). */
export const deleteService = staffMutation({
  roles: ADMIN_ONLY,
  args: { id: v.id('services') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const booked = await ctx.db
      .query('appointments')
      .withIndex('by_serviceId', (q) => q.eq('serviceId', id))
      .first()
    if (booked) fail('HAS_BOOKINGS')
    const links = await ctx.db
      .query('stylistServices')
      .withIndex('by_serviceId', (q) => q.eq('serviceId', id))
      .take(500)
    for (const link of links) await ctx.db.delete('stylistServices', link._id)
    await ctx.db.delete('services', id)
    return null
  },
})

export const saveCategory = staffMutation({
  roles: ADMIN_ONLY,
  args: {
    id: v.union(v.id('serviceCategories'), v.null()),
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    sortOrder: v.number(),
  },
  returns: v.id('serviceCategories'),
  handler: async (ctx, a) => {
    const slug = checkSlug('slug', a.slug)
    await assertSlugFree(ctx, 'serviceCategories', slug, a.id)
    const row = {
      name: text('name', a.name, { max: 80, required: true }),
      slug,
      description: text('description', a.description, { max: 500 }),
      sortOrder: integer('sortOrder', a.sortOrder, 0, 10_000),
      updatedAt: Date.now(),
    }
    if (a.id) {
      if (!(await ctx.db.get('serviceCategories', a.id))) fail('NOT_FOUND')
      await ctx.db.patch('serviceCategories', a.id, row)
      return a.id
    }
    return await ctx.db.insert('serviceCategories', { ...row, isDemo: false })
  },
})

/** Removing a category leaves its services uncategorised. */
export const deleteCategory = staffMutation({
  roles: ADMIN_ONLY,
  args: { id: v.id('serviceCategories') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const services = await ctx.db
      .query('services')
      .withIndex('by_categoryId', (q) => q.eq('categoryId', id))
      .take(500)
    for (const s of services) await ctx.db.patch('services', s._id, { categoryId: undefined, updatedAt: Date.now() })
    await ctx.db.delete('serviceCategories', id)
    return null
  },
})

