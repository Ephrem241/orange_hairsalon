import 'server-only'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { cache } from 'react'
import { isSupabaseConfigured } from '@/lib/env'
import { createSessionClient } from '@/lib/supabase/server'
import type { StaffRole } from '@/lib/types'

export type Staff = {
  id: string
  email: string | null
  fullName: string
  role: StaffRole
  stylistId: string | null
}

export const FRONT_DESK: StaffRole[] = ['admin', 'receptionist']
export const ADMIN_ONLY: StaffRole[] = ['admin']

/** The signed-in, active staff member for this request (deduplicated per request). */
export const getStaff = cache(async (): Promise<Staff | null> => {
  if (!isSupabaseConfigured) return null
  const supabase = await createSessionClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, stylist_id, is_active')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (!profile || !profile.is_active) return null
  return {
    id: profile.id,
    email: auth.user.email ?? null,
    fullName: profile.full_name,
    role: profile.role,
    stylistId: profile.stylist_id,
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
