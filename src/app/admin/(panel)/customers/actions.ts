'use server'

import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { refresh } from 'next/cache'
import { z } from 'zod'
import { authorize, FRONT_DESK, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { convexId } from '@/lib/validation'
import { staffMutation } from '@/lib/convex/server'

const input = z.object({
  id: convexId(),
  fullName: z.string().trim().min(2, 'Enter a name.').max(120),
  email: z.string().trim().max(200).refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email.'),
  staffNotes: z.string().trim().max(2000),
})

/** Phone numbers are deliberately not editable here: they key the client’s bookings. */
export async function updateCustomer(values: z.input<typeof input>): Promise<ActionResult> {
  const auth = await authorize(FRONT_DESK)
  if ('error' in auth) return auth.error
  const parsed = input.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await staffMutation(api.customers.update, { ...parsed.data, id: parsed.data.id as Id<'customers'> })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  refresh()
  return { ok: true, message: 'Client updated.' }
}
