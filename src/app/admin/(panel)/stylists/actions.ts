'use server'

import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { refresh, updateTag } from 'next/cache'
import { z } from 'zod'
import { ADMIN_ONLY, authorize, FRONT_DESK, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { staffMutation } from '@/lib/convex/server'
import { TAGS } from '@/lib/data/tags'
import { normalizePhone } from '@/lib/phone'
import { MEDIA_PATH_PATTERN, slugify } from '@/lib/slug'
import { salonInstant } from '@/lib/time'
import { convexId } from '@/lib/validation'

const stylistInput = z.object({
  id: convexId().nullable(),
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

  let id: string
  try {
    id = await staffMutation(api.stylists.save, {
      ...v,
      id: v.id as Id<'stylists'> | null,
      slug: v.id ? undefined : `${slugify(v.displayName) || 'stylist'}-${crypto.randomUUID().slice(0, 4)}`,
      phone: phone ?? '',
      email: v.email.toLowerCase(),
    })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  updateTag(TAGS.team)
  refresh()
  return { ok: true, message: 'Stylist saved.', data: { id } }
}

export async function setStylistServices(stylistId: string, serviceIds: string[]): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  if (!z.array(convexId()).safeParse(serviceIds).success) return { ok: false, error: 'Invalid services.' }
  try {
    await staffMutation(api.stylists.setServices, { stylistId: stylistId as Id<'stylists'>, serviceIds: serviceIds as Id<'services'>[] })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  updateTag(TAGS.team)
  refresh()
  return { ok: true, message: 'Services updated.' }
}

const period = z.object({
  weekday: z.number().int().min(0).max(6),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().max(60).optional(),
})

export async function setStylistSchedule(stylistId: string, hours: z.input<typeof period>[], breaks: z.input<typeof period>[]): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = z.object({ hours: z.array(period).max(50), breaks: z.array(period).max(50) }).safeParse({ hours, breaks })
  if (!parsed.success) return { ok: false, error: 'Each period needs a start and end time.' }
  if ([...parsed.data.hours, ...parsed.data.breaks].some((p) => p.startsAt >= p.endsAt)) {
    return { ok: false, error: 'Each period must end after it starts.' }
  }
  try {
    await staffMutation(api.stylists.setSchedule, { stylistId: stylistId as Id<'stylists'>, ...parsed.data })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  refresh()
  return { ok: true, message: 'Weekly schedule saved.' }
}

const timeOffInput = z.object({
  stylistId: convexId().nullable(),
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
  const startsAt = Date.parse(salonInstant(v.startDate, v.startTime))
  const endsAt = Date.parse(salonInstant(v.endDate, v.endTime))
  if (endsAt <= startsAt) return { ok: false, error: 'The end must be after the start.' }

  // Existing bookings are kept; flag how many now clash so staff can contact clients.
  let clashes: number
  try {
    ;({ clashes } = await staffMutation(api.stylists.addTimeOff, { stylistId: v.stylistId as Id<'stylists'> | null, startsAt, endsAt, reason: v.reason }))
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  refresh()
  return {
    ok: true,
    message: clashes ? `Saved. ${clashes} existing appointment${clashes === 1 ? '' : 's'} fall in this period — please reschedule or contact those clients.` : 'Time off saved.',
  }
}

export async function deleteTimeOff(id: string, salonWide: boolean): Promise<ActionResult> {
  const auth = await authorize(salonWide ? ADMIN_ONLY : FRONT_DESK)
  if ('error' in auth) return auth.error
  try {
    await staffMutation(api.stylists.removeTimeOff, { id: id as Id<'timeOff'> })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  refresh()
  return { ok: true, message: 'Removed.' }
}
