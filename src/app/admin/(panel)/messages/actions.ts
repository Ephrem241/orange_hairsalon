'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { authorize, FRONT_DESK, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { createSessionClient } from '@/lib/supabase/server'

export async function setMessageStatus(id: string, status: 'new' | 'read' | 'archived'): Promise<ActionResult> {
  const auth = await authorize(FRONT_DESK)
  if ('error' in auth) return auth.error
  if (!z.uuid().safeParse(id).success || !['new', 'read', 'archived'].includes(status)) return { ok: false, error: 'Invalid request.' }
  const db = await createSessionClient()
  const { error } = await db.from('contact_messages').update({ status }).eq('id', id)
  if (error) return { ok: false, error: toAppError(error).message }
  refresh()
  return { ok: true }
}
