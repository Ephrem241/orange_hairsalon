import type { MutationCtx } from '../_generated/server'
import { fail } from './errors'

/** Slugs are unique per table (the old UNIQUE constraint). */
export async function assertSlugFree(
  ctx: MutationCtx,
  table: 'services' | 'serviceCategories' | 'stylists',
  slug: string,
  self: string | null,
): Promise<void> {
  const lookups = {
    services: () => ctx.db.query('services').withIndex('by_slug', (q) => q.eq('slug', slug)).first(),
    serviceCategories: () => ctx.db.query('serviceCategories').withIndex('by_slug', (q) => q.eq('slug', slug)).first(),
    stylists: () => ctx.db.query('stylists').withIndex('by_slug', (q) => q.eq('slug', slug)).first(),
  }
  const other = await lookups[table]()
  if (other && other._id !== self) fail('SLUG_TAKEN')
}
