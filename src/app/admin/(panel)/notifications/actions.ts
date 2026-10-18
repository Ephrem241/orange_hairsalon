'use server'

import { refresh } from 'next/cache'
import { authorize, FRONT_DESK, type ActionResult } from '@/lib/auth/staff'
import { retryNotification } from '@/lib/notifications/notify'
import { isConvexId } from '@/lib/validation'

export async function retryNotificationAction(id: string): Promise<ActionResult> {
  const auth = await authorize(FRONT_DESK)
  if ('error' in auth) return auth.error
  if (!isConvexId(id)) return { ok: false, error: 'Invalid notification.' }
  const outcome = await retryNotification(id)
  refresh()
  if (outcome.status === 'sent') return { ok: true, message: 'Sent.' }
  return { ok: false, error: outcome.error ?? `Not sent (${outcome.status}).` }
}
