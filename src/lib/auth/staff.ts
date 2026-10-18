import 'server-only'
import { api } from '@convex/_generated/api'
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'
import { fetchQuery } from 'convex/nextjs'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { cache } from 'react'
import { isConvexConfigured } from '@/lib/env'
import type { StaffRole } from '@/lib/types'

export type Staff = {
  id: string
  profileId: string
  email: string | null
  fullName: string
  role: StaffRole
  stylistId: string | null
}

export const FRONT_DESK: StaffRole[] = ['admin', 'receptionist']
export const ADMIN_ONLY: StaffRole[] = ['admin']

/** The signed-in, active staff member for this request (deduplicated per request). */
export const getStaff = cache(async (): Promise<Staff | null> => {
  if (!isConvexConfigured) return null
  const token = await convexAuthNextjsToken()
  if (!token) return null
  try {
    const me = await fetchQuery(api.staff.me, {}, { token })
    if (!me) return null
    return { id: me.userId, profileId: me.profileId, email: me.email, fullName: me.fullName, role: me.role, stylistId: me.stylistId }
  } catch (error) {
    console.error('[auth] could not load the staff profile', (error as Error).message)
    return null
  }
})

/** For pages: redirect to login when signed out; null when signed in without the role. */
export async function requirePageStaff(roles?: StaffRole[]): Promise<Staff | null> {
  await connection() // dashboard pages are always request-time (they read the clock and the session)
  const staff = await getStaff()
  if (!staff) redirect('/admin/login')
  if (roles && !roles.includes(staff.role)) return null
  return staff
}

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fields?: Record<string, string> }

/** For server actions: the staff member if allowed, otherwise an error result. */
export async function authorize(roles?: StaffRole[]): Promise<{ staff: Staff } | { error: ActionResult<never> }> {
  const staff = await getStaff()
  if (!staff) return { error: { ok: false, error: 'Your session has ended. Please sign in again.' } }
  if (roles && !roles.includes(staff.role)) return { error: { ok: false, error: 'You don’t have permission to do that.' } }
  return { staff }
}

export const can = {
  manageAppointments: (s: Staff) => FRONT_DESK.includes(s.role),
  administer: (s: Staff) => s.role === 'admin',
}
