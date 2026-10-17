'use server'

import { authorize, type ActionResult } from '@/lib/auth/staff'
import { createSessionClient } from '@/lib/supabase/server'

export async function changePassword(password: string): Promise<ActionResult> {
  const auth = await authorize()
  if ('error' in auth) return auth.error
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return { ok: false, error: 'Use between 12 and 128 characters.' }
  }
  const db = await createSessionClient()
  const { error } = await db.auth.updateUser({ password })
  if (error) return { ok: false, error: error.message }
  return { ok: true, message: 'Password updated.' }
}
