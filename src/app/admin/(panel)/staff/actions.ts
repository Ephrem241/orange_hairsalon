'use server'

import { refresh } from 'next/cache'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { ADMIN_ONLY, authorize, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSessionClient } from '@/lib/supabase/server'

const temporaryPassword = () => randomBytes(12).toString('base64url')

const newStaff = z.object({
  email: z.email('Enter a valid email.'),
  fullName: z.string().trim().min(1, 'Enter a name.').max(120),
  role: z.enum(['admin', 'receptionist', 'stylist']),
  stylistId: z.uuid().nullable(),
})

/**
 * Staff accounts are created only here, by an admin. There is no public sign-up.
 * The secret-key client is used solely for the Auth admin API, after the
 * caller's admin role has been verified.
 */
export async function createStaff(values: z.input<typeof newStaff>): Promise<ActionResult<{ password: string }>> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = newStaff.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  if (v.role === 'stylist' && !v.stylistId) return { ok: false, error: 'Link the stylist login to a stylist profile.' }

  const admin = createAdminClient()
  const password = temporaryPassword()
  const { data, error } = await admin.auth.admin.createUser({
    email: v.email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: v.fullName },
  })
  if (error || !data.user) return { ok: false, error: error?.message.includes('already') ? 'An account with this email already exists.' : (error?.message ?? 'Could not create the account.') }

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: data.user.id, full_name: v.fullName, email: v.email.toLowerCase(), role: v.role, stylist_id: v.role === 'stylist' ? v.stylistId : null })
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id) // keep Auth and profiles consistent
    return { ok: false, error: toAppError(profileError).message }
  }
  refresh()
  return { ok: true, message: 'Account created.', data: { password } }
}

const update = z.object({
  id: z.uuid(),
  fullName: z.string().trim().min(1).max(120),
  role: z.enum(['admin', 'receptionist', 'stylist']),
  stylistId: z.uuid().nullable(),
  isActive: z.boolean(),
})

/** Runs with the admin's own session: RLS and the "keep one admin" trigger apply. */
export async function updateStaff(values: z.input<typeof update>): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = update.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  const db = await createSessionClient()
  const { error } = await db
    .from('profiles')
    .update({ full_name: v.fullName, role: v.role, stylist_id: v.role === 'stylist' ? v.stylistId : null, is_active: v.isActive })
    .eq('id', v.id)
  if (error) return { ok: false, error: toAppError(error).message }
  refresh()
  return { ok: true, message: v.isActive ? 'Access updated.' : 'Access removed. They can no longer use the dashboard.' }
}

export async function resetStaffPassword(id: string): Promise<ActionResult<{ password: string }>> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  if (!z.uuid().safeParse(id).success) return { ok: false, error: 'Invalid account.' }
  const password = temporaryPassword()
  const { error } = await createAdminClient().auth.admin.updateUserById(id, { password })
  if (error) return { ok: false, error: error.message }
  return { ok: true, message: 'Password reset.', data: { password } }
}
