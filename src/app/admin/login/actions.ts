'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { getStaff } from '@/lib/auth/staff'
import { allowRequest, clientIp } from '@/lib/security/rate-limit'

const credentials = z.object({
  email: z.email('Enter your email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

/** Validates the form and applies the per-IP limit before the browser signs in. */
export async function prepareSignIn(email: string, password: string): Promise<{ error: string | null }> {
  const parsed = credentials.safeParse({ email: email.trim().toLowerCase(), password })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await allowRequest('login:ip', clientIp(await headers()), 10, 900))) {
    return { error: 'Too many sign-in attempts. Please wait 15 minutes.' }
  }
  return { error: null }
}

/** A valid account is not enough: it must belong to an active staff profile. */
export async function confirmStaffAccess(): Promise<boolean> {
  return (await getStaff()) !== null
}
