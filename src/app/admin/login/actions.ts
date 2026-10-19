'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { getStaff } from '@/lib/auth/staff'
import { allowRequest, clientIp } from '@/lib/security/rate-limit'

const emailSchema = z.email('Enter your email address.')

/**
 * Validates the email and applies the per-IP limit before the browser signs in.
 * The password never comes through here: it goes only to /api/auth, so it can't
 * appear in server-action logs.
 */
export async function prepareSignIn(email: string): Promise<{ error: string | null }> {
  const parsed = emailSchema.safeParse(email.trim().toLowerCase())
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
