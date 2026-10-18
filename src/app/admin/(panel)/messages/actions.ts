'use server'

import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { refresh } from 'next/cache'
import { authorize, FRONT_DESK, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { isConvexId } from '@/lib/validation'
import { staffMutation } from '@/lib/convex/server'

export async function setMessageStatus(id: string, status: 'new' | 'read' | 'archived'): Promise<ActionResult> {
  const auth = await authorize(FRONT_DESK)
  if ('error' in auth) return auth.error
  if (!isConvexId(id) || !['new', 'read', 'archived'].includes(status)) return { ok: false, error: 'Invalid request.' }
  try {
    await staffMutation(api.content.setMessageStatus, { id: id as Id<'contactMessages'>, status })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  refresh()
  return { ok: true }
}
