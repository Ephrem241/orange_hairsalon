/**
 * Staff accounts and dashboard access. Accounts are created only by an admin
 * (or the one-off bootstrap command for the first admin); there is no public
 * sign-up. The salon always keeps at least one active admin.
 */
import { createAccount, getAuthSessionId, invalidateSessions, modifyAccountCredentials } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action, internalAction, internalMutation, internalQuery, query, type ActionCtx, type MutationCtx } from './_generated/server'
import { ADMIN_ONLY, auditedDb, getStaff, staffMutation, staffQuery, type Staff } from './lib/access'
import { fail } from './lib/errors'
import { checkPassword, EMAIL, text } from './lib/validate'
import { staffRoleValidator, type StaffRole } from './lib/validators'
import schema from './schema'

const staffValidator = v.object({
  userId: v.id('users'),
  profileId: v.id('staffProfiles'),
  fullName: v.string(),
  email: v.string(),
  role: staffRoleValidator,
  stylistId: v.union(v.id('stylists'), v.null()),
})

/** The signed-in staff member, or null (signed out, no profile, or deactivated). */
export const me = query({
  args: {},
  returns: v.union(staffValidator, v.null()),
  handler: async (ctx) => await getStaff(ctx),
})

export const list = staffQuery({
  roles: ADMIN_ONLY,
  args: {},
  returns: v.array(schema.doc('staffProfiles')),
  handler: async (ctx) => await ctx.db.query('staffProfiles').take(500),
})

/** A stylist login must point at a stylist profile (one login per stylist); other roles may not. */
async function checkStylistLink(ctx: MutationCtx, role: StaffRole, stylistId: Id<'stylists'> | null, self?: Id<'staffProfiles'>) {
  if (role !== 'stylist') return undefined
  if (!stylistId) fail('STYLIST_LINK_REQUIRED')
  if (!(await ctx.db.get('stylists', stylistId))) fail('NOT_FOUND')
  const linked = await ctx.db
    .query('staffProfiles')
    .withIndex('by_stylistId', (q) => q.eq('stylistId', stylistId))
    .first()
  if (linked && linked._id !== self) fail('STYLIST_ALREADY_LINKED')
  return stylistId
}

/** Runs with the admin's identity; the last active admin can't be demoted or deactivated. */
export const update = staffMutation({
  roles: ADMIN_ONLY,
  args: {
    id: v.id('staffProfiles'),
    fullName: v.string(),
    role: staffRoleValidator,
    stylistId: v.union(v.id('stylists'), v.null()),
    isActive: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const profile = (await ctx.db.get('staffProfiles', a.id)) ?? fail('NOT_FOUND')
    if (profile.role === 'admin' && profile.isActive && (a.role !== 'admin' || !a.isActive)) {
      const admins = await ctx.db
        .query('staffProfiles')
        .withIndex('by_role_and_isActive', (q) => q.eq('role', 'admin').eq('isActive', true))
        .take(10)
      if (!admins.some((p) => p._id !== profile._id)) fail('LAST_ADMIN')
    }
    await ctx.db.patch('staffProfiles', a.id, {
      fullName: text('fullName', a.fullName, { max: 120, required: true }),
      role: a.role,
      stylistId: await checkStylistLink(ctx, a.role, a.stylistId, a.id),
      isActive: a.isActive,
      updatedAt: Date.now(),
    })
    return null
  },
})

// ── Account management (actions: password hashing runs in Convex Auth) ──────
export const callerForAction = internalQuery({
  args: {},
  returns: v.union(staffValidator, v.null()),
  handler: async (ctx) => await getStaff(ctx),
})

export const accountTaken = internalQuery({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const account = await ctx.db
      .query('authAccounts')
      .withIndex('providerAndAccountId', (q) => q.eq('provider', 'password').eq('providerAccountId', email))
      .first()
    const profile = await ctx.db
      .query('staffProfiles')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first()
    return account !== null || profile !== null
  },
})

export const insertProfile = internalMutation({
  args: {
    userId: v.id('users'),
    fullName: v.string(),
    email: v.string(),
    role: staffRoleValidator,
    stylistId: v.union(v.id('stylists'), v.null()),
    actor: v.union(staffValidator, v.null()),
  },
  returns: v.id('staffProfiles'),
  handler: async (ctx, a) => {
    const db = auditedDb(ctx, a.actor ?? undefined)
    const stylistId = await checkStylistLink(ctx, a.role, a.stylistId)
    const existing = await ctx.db
      .query('staffProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', a.userId))
      .unique()
    const row = {
      userId: a.userId,
      fullName: text('fullName', a.fullName, { max: 120, required: true }),
      email: a.email,
      role: a.role,
      stylistId,
      isActive: true,
      updatedAt: Date.now(),
    }
    if (existing) {
      await db.patch('staffProfiles', existing._id, row)
      return existing._id
    }
    return await db.insert('staffProfiles', row)
  },
})

/** Undo a half-created account (profile insert failed). */
export const deleteUser = internalMutation({
  args: { userId: v.id('users') },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const accounts = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
      .take(20)
    for (const account of accounts) await ctx.db.delete('authAccounts', account._id)
    await ctx.db.delete('users', userId)
    return null
  },
})

export const profileById = internalQuery({
  args: { id: v.id('staffProfiles') },
  returns: v.union(schema.doc('staffProfiles'), v.null()),
  handler: async (ctx, { id }) => await ctx.db.get('staffProfiles', id),
})

async function requireAdmin(ctx: ActionCtx): Promise<Staff> {
  const caller = await ctx.runQuery(internal.staff.callerForAction, {})
  if (!caller || caller.role !== 'admin') fail('FORBIDDEN')
  return caller
}

function normalizeEmail(email: string): string {
  const value = email.trim().toLowerCase()
  if (!EMAIL.test(value) || value.length > 200) fail('INVALID_EMAIL')
  return value
}

async function createLogin(
  ctx: ActionCtx,
  a: { email: string; fullName: string; role: StaffRole; stylistId: Id<'stylists'> | null; password: string },
  actor: Staff | null,
) {
  const { user } = await createAccount(ctx, {
    provider: 'password',
    account: { id: a.email, secret: a.password },
    profile: { email: a.email, name: a.fullName },
  })
  try {
    await ctx.runMutation(internal.staff.insertProfile, { userId: user._id, fullName: a.fullName, email: a.email, role: a.role, stylistId: a.stylistId, actor })
  } catch (error) {
    await ctx.runMutation(internal.staff.deleteUser, { userId: user._id }) // keep accounts and profiles consistent
    throw error
  }
  return user._id
}

/** Admins add team members. The Next.js server generates the temporary password it shows once. */
export const createStaff = action({
  args: {
    email: v.string(),
    fullName: v.string(),
    role: staffRoleValidator,
    stylistId: v.union(v.id('stylists'), v.null()),
    password: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const actor = await requireAdmin(ctx)
    const email = normalizeEmail(a.email)
    checkPassword(a.password)
    if (a.role === 'stylist' && !a.stylistId) fail('STYLIST_LINK_REQUIRED')
    if (await ctx.runQuery(internal.staff.accountTaken, { email })) fail('ACCOUNT_EXISTS')
    await createLogin(ctx, { ...a, email }, actor)
    return null
  },
})

export const resetPassword = action({
  args: { id: v.id('staffProfiles'), password: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, password }) => {
    await requireAdmin(ctx)
    checkPassword(password)
    const profile = (await ctx.runQuery(internal.staff.profileById, { id })) ?? fail('NOT_FOUND')
    await modifyAccountCredentials(ctx, { provider: 'password', account: { id: profile.email, secret: password } })
    await invalidateSessions(ctx, { userId: profile.userId })
    return null
  },
})

/** Any signed-in staff member changes their own password; other sessions are signed out. */
export const changeOwnPassword = action({
  args: { password: v.string() },
  returns: v.null(),
  handler: async (ctx, { password }) => {
    const caller = (await ctx.runQuery(internal.staff.callerForAction, {})) ?? fail('FORBIDDEN')
    checkPassword(password)
    await modifyAccountCredentials(ctx, { provider: 'password', account: { id: caller.email, secret: password } })
    const sessionId = await getAuthSessionId(ctx)
    await invalidateSessions(ctx, { userId: caller.userId, except: sessionId ? [sessionId] : [] })
    return null
  },
})

export const findProfileByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(schema.doc('staffProfiles'), v.null()),
  handler: async (ctx, { email }) =>
    await ctx.db
      .query('staffProfiles')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first(),
})

export const accountUserId = internalQuery({
  args: { email: v.string() },
  returns: v.union(v.id('users'), v.null()),
  handler: async (ctx, { email }) => {
    const account = await ctx.db
      .query('authAccounts')
      .withIndex('providerAndAccountId', (q) => q.eq('provider', 'password').eq('providerAccountId', email))
      .first()
    return account?.userId ?? null
  },
})

/**
 * Create (or promote and reset) the salon's first administrator:
 *   npx convex run staff:bootstrapAdmin '{"email":"…","name":"…","password":"…"}'
 * Use `npm run admin:create`, which generates a strong temporary password.
 */
export const bootstrapAdmin = internalAction({
  args: { email: v.string(), name: v.string(), password: v.string() },
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx, a) => {
    const email = normalizeEmail(a.email)
    checkPassword(a.password)
    const existingUser = await ctx.runQuery(internal.staff.accountUserId, { email })
    if (existingUser) {
      await modifyAccountCredentials(ctx, { provider: 'password', account: { id: email, secret: a.password } })
      await ctx.runMutation(internal.staff.insertProfile, { userId: existingUser, fullName: a.name, email, role: 'admin', stylistId: null, actor: null })
      return { created: false }
    }
    await createLogin(ctx, { email, fullName: a.name, role: 'admin', stylistId: null, password: a.password }, null)
    return { created: true }
  },
})
