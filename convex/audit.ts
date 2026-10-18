/** The audit trail of administrative changes (admins only). */
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { ADMIN_ONLY, staffQuery } from './lib/access'
import schema from './schema'

export const list = staffQuery({
  roles: ADMIN_ONLY,
  args: {},
  returns: v.array(v.object({ ...schema.doc('auditEvents').fields, actorName: v.union(v.string(), v.null()) })),
  handler: async (ctx) => {
    const rows = await ctx.db.query('auditEvents').order('desc').take(200)
    const names = new Map<Id<'users'>, string | null>()
    for (const row of rows) {
      if (row.actorId && !names.has(row.actorId)) {
        const profile = await ctx.db
          .query('staffProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', row.actorId!))
          .unique()
        names.set(row.actorId, profile?.fullName ?? null)
      }
    }
    return rows.map((row) => ({ ...row, actorName: row.actorId ? (names.get(row.actorId) ?? null) : null }))
  },
})
