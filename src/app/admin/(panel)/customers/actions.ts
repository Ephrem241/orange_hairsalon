'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { authorize, FRONT_DESK, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { createSessionClient } from '@/lib/supabase/server'

const input = z.object({
  id: z.uuid(),
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
  const db = await createSessionClient()
  const { error } = await db
    .from('customers')
    .update({ full_name: parsed.data.fullName, email: parsed.data.email.toLowerCase() || null, staff_notes: parsed.data.staffNotes || null })
    .eq('id', parsed.data.id)
  if (error) return { ok: false, error: toAppError(error).message }
  refresh()
  return { ok: true, message: 'Client updated.' }
}
