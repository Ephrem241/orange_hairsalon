/**
 * Fixed-window rate limiting shared across serverless instances. Keys are
 * salted hashes made by the Next.js server; raw IPs and phones never arrive here.
 */
import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { serverMutation } from './lib/access'
import { DAY } from './lib/time'

/** Records a hit; true when the caller is still within `limit` for the window. */
export const consume = serverMutation({
  args: { key: v.string(), limit: v.number(), windowSeconds: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { key, limit, windowSeconds }) => {
    const now = Date.now()
    const row = await ctx.db
      .query('rateLimits')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique()
    if (!row) {
      await ctx.db.insert('rateLimits', { key, windowStart: now, hits: 1 })
      return 1 <= limit
    }
    const expired = row.windowStart < now - windowSeconds * 1000
    const hits = expired ? 1 : row.hits + 1
    await ctx.db.patch('rateLimits', row._id, { hits, windowStart: expired ? now : row.windowStart })
    return hits <= limit
  },
})

/** Hourly cleanup (crons.ts): drop windows older than a day, in batches. */
export const prune = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const old = await ctx.db
      .query('rateLimits')
      .withIndex('by_windowStart', (q) => q.lt('windowStart', Date.now() - DAY))
      .take(1000)
    for (const row of old) await ctx.db.delete('rateLimits', row._id)
    return old.length
  },
})
