'use server'

import { refresh, updateTag } from 'next/cache'
import { z } from 'zod'
import { ADMIN_ONLY, authorize, FRONT_DESK, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { TAGS } from '@/lib/data/tags'
import { normalizePhone } from '@/lib/phone'
import { MEDIA_PATH_PATTERN, slugify } from '@/lib/slug'
import { createSessionClient } from '@/lib/supabase/server'
import { salonInstant } from '@/lib/time'

const stylistInput = z.object({
  id: z.uuid().nullable(),
  displayName: z.string().trim().min(1, 'Enter a name.').max(80),
  title: z.string().trim().max(80),
  bio: z.string().trim().max(2000),
  photoPath: z.string().regex(MEDIA_PATH_PATTERN).nullable(),
  isActive: z.boolean(),
  acceptsOnlineBooking: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
  phone: z.string().trim().max(30),
  email: z.string().trim().max(200).refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email.'),
})

export async function saveStylist(values: z.input<typeof stylistInput>): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = stylistInput.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  const phone = v.phone ? normalizePhone(v.phone) : null
  if (v.phone && !phone) return { ok: false, error: 'Enter a valid phone number.' }

  const db = await createSessionClient()
  const row = {
    display_name: v.displayName,
    title: v.title || null,
    bio: v.bio || null,
    photo_path: v.photoPath,
    is_active: v.isActive,
    accepts_online_booking: v.acceptsOnlineBooking,
    sort_order: v.sortOrder,
  }
  const result = v.id
    ? await db.from('stylists').update(row).eq('id', v.id).select('id').single()
    : await db.from('stylists').insert({ ...row, slug: `${slugify(v.displayName)}-${crypto.randomUUID().slice(0, 4)}` }).select('id').single()
  if (result.error) return { ok: false, error: toAppError(result.error).message }

  const { error: contactError } = await db
    .from('stylist_contacts')
    .upsert({ stylist_id: result.data.id, phone, email: v.email.toLowerCase() || null })
  if (contactError) return { ok: false, error: toAppError(contactError).message }

  updateTag(TAGS.team)
  refresh()
  return { ok: true, message: 'Stylist saved.', data: { id: result.data.id } }
}

export async function setStylistServices(stylistId: string, serviceIds: string[]): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  if (!z.array(z.uuid()).safeParse(serviceIds).success) return { ok: false, error: 'Invalid services.' }
  const db = await createSessionClient()
  const { error } = await db.rpc('set_stylist_services', { p_stylist_id: stylistId, p_service_ids: serviceIds })
  if (error) return { ok: false, error: toAppError(error).message }
  updateTag(TAGS.team)
  refresh()
  return { ok: true, message: 'Services updated.' }
}

const period = z.object({
  weekday: z.number().int().min(0).max(6),
  starts_at: z.string().regex(/^\d{2}:\d{2}$/),
  ends_at: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().max(60).optional(),
})

export async function setStylistSchedule(stylistId: string, hours: z.input<typeof period>[], breaks: z.input<typeof period>[]): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = z.object({ hours: z.array(period).max(50), breaks: z.array(period).max(50) }).safeParse({ hours, breaks })
  if (!parsed.success) return { ok: false, error: 'Each period needs a start and end time.' }
  if ([...parsed.data.hours, ...parsed.data.breaks].some((p) => p.starts_at >= p.ends_at)) {
    return { ok: false, error: 'Each period must end after it starts.' }
  }
  const db = await createSessionClient()
  const { error } = await db.rpc('set_stylist_schedule', { p_stylist_id: stylistId, p_hours: parsed.data.hours, p_breaks: parsed.data.breaks })
  if (error) return { ok: false, error: toAppError(error).message }
  refresh()
  return { ok: true, message: 'Weekly schedule saved.' }
}

const timeOffInput = z.object({
  stylistId: z.uuid().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(200),
})

/** Time off for one stylist, or a salon-wide closure when stylistId is null. Times are salon-local. */
export async function addTimeOff(values: z.input<typeof timeOffInput>): Promise<ActionResult> {
  const auth = await authorize(values.stylistId ? FRONT_DESK : ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = timeOffInput.safeParse(values)
  if (!parsed.success) return { ok: false, error: 'Enter a start and end date and time.' }
  const v = parsed.data
  const startsAt = salonInstant(v.startDate, v.startTime)
  const endsAt = salonInstant(v.endDate, v.endTime)
  if (endsAt <= startsAt) return { ok: false, error: 'The end must be after the start.' }

  const db = await createSessionClient()
  const { error } = await db.from('time_off').insert({ stylist_id: v.stylistId, starts_at: startsAt, ends_at: endsAt, reason: v.reason || null, created_by: auth.staff.id })
  if (error) return { ok: false, error: toAppError(error).message }

  // Existing bookings are kept; flag how many now clash so staff can contact clients.
  let query = db.from('appointments').select('id', { count: 'exact', head: true }).in('status', ['pending', 'confirmed']).lt('starts_at', endsAt).gt('blocked_until', startsAt)
  if (v.stylistId) query = query.eq('stylist_id', v.stylistId)
  const { count } = await query
  refresh()
  return {
    ok: true,
    message: count ? `Saved. ${count} existing appointment${count === 1 ? '' : 's'} fall in this period — please reschedule or contact those clients.` : 'Time off saved.',
  }
}

export async function deleteTimeOff(id: string, salonWide: boolean): Promise<ActionResult> {
  const auth = await authorize(salonWide ? ADMIN_ONLY : FRONT_DESK)
  if ('error' in auth) return auth.error
  const db = await createSessionClient()
  const { error } = await db.from('time_off').delete().eq('id', id)
  if (error) return { ok: false, error: toAppError(error).message }
  refresh()
  return { ok: true, message: 'Removed.' }
}
