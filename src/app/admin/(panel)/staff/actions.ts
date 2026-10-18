'use server'

import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { refresh } from 'next/cache'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { ADMIN_ONLY, authorize, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { staffAction, staffMutation } from '@/lib/convex/server'
import { convexId } from '@/lib/validation'

const temporaryPassword = () => randomBytes(12).toString('base64url')

const newStaff = z.object({
  email: z.email('Enter a valid email.'),
  fullName: z.string().trim().min(1, 'Enter a name.').max(120),
  role: z.enum(['admin', 'receptionist', 'stylist']),
  stylistId: convexId().nullable(),
})

/**
 * Staff accounts are created only here, by an admin. There is no public
 * sign-up; Convex re-checks the caller's admin role before creating the login.
 */
export async function createStaff(values: z.input<typeof newStaff>): Promise<ActionResult<{ password: string }>> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = newStaff.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  if (v.role === 'stylist' && !v.stylistId) return { ok: false, error: 'Link the stylist login to a stylist profile.' }

  const password = temporaryPassword()
  try {
    await staffAction(api.staff.createStaff, {
      email: v.email.toLowerCase(),
      fullName: v.fullName,
      role: v.role,
      stylistId: v.role === 'stylist' ? (v.stylistId as Id<'stylists'>) : null,
      password,
    })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  refresh()
  return { ok: true, message: 'Account created.', data: { password } }
}

const update = z.object({
  id: convexId(),
  fullName: z.string().trim().min(1).max(120),
  role: z.enum(['admin', 'receptionist', 'stylist']),
  stylistId: convexId().nullable(),
  isActive: z.boolean(),
})

/** Convex keeps at least one active admin and enforces the stylist link. */
export async function updateStaff(values: z.input<typeof update>): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = update.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  try {
    await staffMutation(api.staff.update, {
      id: v.id as Id<'staffProfiles'>,
      fullName: v.fullName,
      role: v.role,
      stylistId: v.role === 'stylist' ? (v.stylistId as Id<'stylists'> | null) : null,
      isActive: v.isActive,
    })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  refresh()
  return { ok: true, message: v.isActive ? 'Access updated.' : 'Access removed. They can no longer use the dashboard.' }
}

export async function resetStaffPassword(id: string): Promise<ActionResult<{ password: string }>> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  if (!convexId().safeParse(id).success) return { ok: false, error: 'Invalid account.' }
  const password = temporaryPassword()
  try {
    await staffAction(api.staff.resetPassword, { id: id as Id<'staffProfiles'>, password })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  return { ok: true, message: 'Password reset.', data: { password } }
}
