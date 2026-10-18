/**
 * Who may call what. These builders replace the old row-level security and
 * private.* role helpers:
 *
 *   staffQuery / staffMutation — a signed-in user with an ACTIVE staff profile,
 *     optionally restricted to roles. Stylists are additionally scoped to their
 *     own diary inside each function.
 *   serverQuery / serverMutation — the Next.js server only, proven by the
 *     CONVEX_SERVER_SECRET shared secret. This is the public booking API,
 *     customer self-service, rate limiting and notification bookkeeping, which
 *     the website exposes only through its own validated, rate-limited routes.
 *
 * Plain `query` is used only for published content (catalogue, settings,
 * gallery, reviews) that is safe for anyone to read.
 *
 * Mutations made through staffMutation write through a database wrapper that
 * records an audit trail of changes to the administrative tables.
 */
import { getAuthUserId } from '@convex-dev/auth/server'
import { customMutation, customQuery } from 'convex-helpers/server/customFunctions'
import { Triggers } from 'convex-helpers/server/triggers'
import { v } from 'convex/values'
import type { DataModel, Id } from '../_generated/dataModel'
import { env, mutation, query, type MutationCtx, type QueryCtx } from '../_generated/server'
import { fail } from './errors'
import type { StaffRole } from './validators'

export type Staff = {
  userId: Id<'users'>
  profileId: Id<'staffProfiles'>
  fullName: string
  email: string
  role: StaffRole
  stylistId: Id<'stylists'> | null
}

export const FRONT_DESK = ['admin', 'receptionist'] as const satisfies readonly StaffRole[]
export const ADMIN_ONLY = ['admin'] as const satisfies readonly StaffRole[]

/** The signed-in, active staff member, or null. */
export async function getStaff(ctx: QueryCtx): Promise<Staff | null> {
  const userId = await getAuthUserId(ctx)
  if (userId === null) return null
  const profile = await ctx.db
    .query('staffProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  if (!profile || !profile.isActive) return null
  return {
    userId,
    profileId: profile._id,
    fullName: profile.fullName,
    email: profile.email,
    role: profile.role,
    stylistId: profile.stylistId ?? null,
  }
}

export async function requireStaff(ctx: QueryCtx, roles?: readonly StaffRole[]): Promise<Staff> {
  const staff = await getStaff(ctx)
  if (!staff || (roles && !roles.includes(staff.role))) fail('FORBIDDEN')
  return staff
}

export const isFrontDesk = (staff: Staff) => staff.role === 'admin' || staff.role === 'receptionist'

// ── Audit trail ──────────────────────────────────────────────────────────────
type AuditCtx = MutationCtx & { staff?: Staff }
const triggers = new Triggers<DataModel, AuditCtx>()

const AUDITED = [
  'businessSettings',
  'notificationSettings',
  'businessHours',
  'serviceCategories',
  'services',
  'stylists',
  'stylistContacts',
  'stylistServices',
  'timeOff',
  'galleryItems',
  'reviews',
  'staffProfiles',
] as const

for (const table of AUDITED) {
  triggers.register(table as 'services', async (ctx, change) => {
    await ctx.innerDb.insert('auditEvents', {
      actorId: ctx.staff?.userId,
      actorRole: ctx.staff?.role,
      action: change.operation,
      entity: table,
      entityId: change.id,
      before: change.oldDoc ?? undefined,
      after: change.newDoc ?? undefined,
    })
  })
}

/** A mutation ctx whose writes are audited and attributed to `staff`. */
export function auditedDb(ctx: MutationCtx, staff?: Staff) {
  return triggers.wrapDB({ ...ctx, staff }).db
}

// ── Function builders ────────────────────────────────────────────────────────
type RoleOption = { roles?: readonly StaffRole[] }

export const staffQuery = customQuery(query, {
  args: {},
  input: async (ctx, _args, { roles }: RoleOption) => ({ ctx: { staff: await requireStaff(ctx, roles) }, args: {} }),
})

export const staffMutation = customMutation(mutation, {
  args: {},
  input: async (ctx, _args, { roles }: RoleOption) => {
    const staff = await requireStaff(ctx, roles)
    return { ctx: { staff, db: auditedDb(ctx, staff) }, args: {} }
  },
})

/** Constant-time comparison, so the secret cannot be guessed byte by byte. */
function sameSecret(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

/** Throws unless `given` is this deployment's CONVEX_SERVER_SECRET (fails closed when unset). */
export function checkServerSecret(given: string): void {
  const expected = env.CONVEX_SERVER_SECRET
  if (!expected || expected.length < 16 || !sameSecret(given, expected)) fail('FORBIDDEN')
}

const serverArgs = { serverSecret: v.string() }

export const serverQuery = customQuery(query, {
  args: serverArgs,
  input: async (_ctx, { serverSecret }) => {
    checkServerSecret(serverSecret)
    return { ctx: {}, args: {} }
  },
})

export const serverMutation = customMutation(mutation, {
  args: serverArgs,
  input: async (_ctx, { serverSecret }) => {
    checkServerSecret(serverSecret)
    return { ctx: {}, args: {} }
  },
})
