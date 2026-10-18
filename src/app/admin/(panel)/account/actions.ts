'use server'

import { api } from '@convex/_generated/api'
import { authorize, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { staffAction } from '@/lib/convex/server'

/** Changes the signed-in staff member's password; their other sessions are signed out. */
export async function changePassword(password: string): Promise<ActionResult> {
  const auth = await authorize()
  if ('error' in auth) return auth.error
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return { ok: false, error: 'Use between 12 and 128 characters.' }
  }
  try {
    await staffAction(api.staff.changeOwnPassword, { password })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  return { ok: true, message: 'Password updated.' }
}
