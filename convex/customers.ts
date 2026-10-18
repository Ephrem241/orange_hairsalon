/**
 * Clients, created automatically from bookings and matched by phone number.
 * Front desk only. The phone number is deliberately not editable: it keys the
 * client's bookings and their self-service access.
 */
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { FRONT_DESK, staffMutation, staffQuery } from './lib/access'
import { fail } from './lib/errors'
import { customerSearchText } from './lib/records'
import { optionalEmail, text } from './lib/validate'
import schema from './schema'

async function withVisits(ctx: QueryCtx, c: Doc<'customers'>) {
  const appointments = await ctx.db
    .query('appointments')
    .withIndex('by_customerId_and_startsAt', (q) => q.eq('customerId', c._id))
    .take(1000)
  const completed = appointments.filter((a) => a.status === 'completed')
  return { ...c, visits: appointments.length, lastVisit: completed.at(-1)?.startsAt ?? null }
}

export const list = staffQuery({
  roles: FRONT_DESK,
  args: { q: v.optional(v.string()) },
  returns: v.array(v.object({ ...schema.doc('customers').fields, visits: v.number(), lastVisit: v.union(v.number(), v.null()) })),
  handler: async (ctx, { q }) => {
    const term = q?.trim()
    let rows: Doc<'customers'>[]
    if (term) {
      // Phone numbers are matched on their last nine digits.
      const digits = term.replace(/\D/g, '')
      rows = await ctx.db
        .query('customers')
        .withSearchIndex('search_text', (s) => s.search('searchText', digits.length >= 4 ? digits.slice(-9) : term))
        .take(100)
    } else {
      rows = await ctx.db.query('customers').order('desc').take(100)
    }
    return await Promise.all(rows.map((c) => withVisits(ctx, c)))
  },
})

export const get = staffQuery({
  roles: FRONT_DESK,
  args: { id: v.id('customers') },
  returns: v.union(schema.doc('customers'), v.null()),
  handler: async (ctx, { id }) => await ctx.db.get('customers', id),
})

export const update = staffMutation({
  roles: FRONT_DESK,
  args: { id: v.id('customers'), fullName: v.string(), email: v.string(), staffNotes: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const customer = (await ctx.db.get('customers', a.id)) ?? fail('NOT_FOUND')
    const fullName = text('fullName', a.fullName, { min: 2, max: 120, required: true })
    const email = optionalEmail('email', a.email)
    await ctx.db.patch('customers', a.id, {
      fullName,
      email,
      staffNotes: text('staffNotes', a.staffNotes, { max: 2000 }),
      searchText: customerSearchText(fullName, customer.phoneE164, email),
      updatedAt: Date.now(),
    })
    return null
  },
})
