'use server'

import { refresh, updateTag } from 'next/cache'
import { z } from 'zod'
import { ADMIN_ONLY, authorize, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { TAGS } from '@/lib/data/tags'
import { normalizePhone } from '@/lib/phone'
import { createSessionClient } from '@/lib/supabase/server'

const httpsOrEmpty = z.string().trim().refine((v) => v === '' || /^https:\/\/[^\s]+$/.test(v), 'Links must start with https://')
const emailOrEmpty = z.string().trim().refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email.')

const business = z.object({
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200),
  phone: z.string().trim().max(30),
  whatsapp: z.string().trim().max(30),
  email: emailOrEmpty,
  addressLine: z.string().trim().max(200),
  city: z.string().trim().min(1).max(80),
  mapUrl: httpsOrEmpty,
  latitude: z.string().trim(),
  longitude: z.string().trim(),
  socials: z.object({ instagram: httpsOrEmpty, facebook: httpsOrEmpty, tiktok: httpsOrEmpty, youtube: httpsOrEmpty, telegram: httpsOrEmpty }),
  aboutStory: z.string().trim().max(6000),
})

export async function saveBusinessSettings(values: z.input<typeof business>): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = business.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  const phone = v.phone ? normalizePhone(v.phone) : null
  const whatsapp = v.whatsapp ? normalizePhone(v.whatsapp) : null
  if (v.phone && !phone) return { ok: false, error: 'Enter a valid salon phone number.' }
  if (v.whatsapp && !whatsapp) return { ok: false, error: 'Enter a valid WhatsApp number.' }
  const lat = v.latitude === '' ? null : Number(v.latitude)
  const lng = v.longitude === '' ? null : Number(v.longitude)
  if ((lat === null) !== (lng === null) || (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) || (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))) {
    return { ok: false, error: 'Enter both latitude and longitude, or neither.' }
  }
  const socials = Object.fromEntries(Object.entries(v.socials).filter(([, url]) => url))

  const db = await createSessionClient()
  const { error } = await db
    .from('business_settings')
    .update({
      name: v.name, tagline: v.tagline || null, phone, whatsapp, email: v.email.toLowerCase() || null,
      address_line: v.addressLine || null, city: v.city, map_url: v.mapUrl || null, latitude: lat, longitude: lng,
      socials, about_story: v.aboutStory || null,
    })
    .eq('id', 1)
  if (error) return { ok: false, error: toAppError(error).message }
  updateTag(TAGS.settings)
  refresh()
  return { ok: true, message: 'Business details saved.' }
}

const policy = z.object({
  onlineBookingEnabled: z.boolean(),
  autoConfirm: z.boolean(),
  requireEmail: z.boolean(),
  allowCustomerCancel: z.boolean(),
  allowCustomerReschedule: z.boolean(),
  minLeadMinutes: z.number().int().min(0).max(10080),
  maxAdvanceDays: z.number().int().min(1).max(365),
  slotIntervalMin: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(60)]),
  defaultBufferMin: z.number().int().min(0).max(120),
  cancelCutoffHours: z.number().int().min(0).max(336),
  policyText: z.string().trim().max(6000),
})

export async function saveBookingPolicy(values: z.input<typeof policy>): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = policy.safeParse(values)
  if (!parsed.success) return { ok: false, error: `Check “${String(parsed.error.issues[0].path[0])}”: ${parsed.error.issues[0].message}` }
  const v = parsed.data
  const db = await createSessionClient()
  const { error } = await db
    .from('business_settings')
    .update({
      online_booking_enabled: v.onlineBookingEnabled, auto_confirm: v.autoConfirm, require_email: v.requireEmail,
      allow_customer_cancel: v.allowCustomerCancel, allow_customer_reschedule: v.allowCustomerReschedule,
      min_lead_minutes: v.minLeadMinutes, max_advance_days: v.maxAdvanceDays, slot_interval_min: v.slotIntervalMin,
      default_buffer_min: v.defaultBufferMin, cancel_cutoff_hours: v.cancelCutoffHours, policy_text: v.policyText || null,
    })
    .eq('id', 1)
  if (error) return { ok: false, error: toAppError(error).message }
  updateTag(TAGS.settings)
  refresh()
  return { ok: true, message: 'Booking policy saved.' }
}

const hoursInput = z.array(
  z.object({ weekday: z.number().int().min(0).max(6), isClosed: z.boolean(), opensAt: z.string().regex(/^\d{2}:\d{2}$/), closesAt: z.string().regex(/^\d{2}:\d{2}$/) }),
).length(7)

export async function saveBusinessHours(values: z.input<typeof hoursInput>): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = hoursInput.safeParse(values)
  if (!parsed.success) return { ok: false, error: 'Enter opening and closing times for every open day.' }
  if (parsed.data.some((d) => !d.isClosed && d.opensAt >= d.closesAt)) return { ok: false, error: 'Closing time must be after opening time.' }
  const db = await createSessionClient()
  const { error } = await db.from('business_hours').upsert(
    parsed.data.map((d) => ({ weekday: d.weekday, is_closed: d.isClosed, opens_at: d.isClosed ? null : d.opensAt, closes_at: d.isClosed ? null : d.closesAt })),
  )
  if (error) return { ok: false, error: toAppError(error).message }
  updateTag(TAGS.settings)
  refresh()
  return { ok: true, message: 'Opening hours saved.' }
}

const notify = z.object({ emailEnabled: z.boolean(), whatsappEnabled: z.boolean(), remindersEnabled: z.boolean(), salonAlertEmail: emailOrEmpty })

export async function saveNotificationSettings(values: z.input<typeof notify>): Promise<ActionResult> {
  const auth = await authorize(ADMIN_ONLY)
  if ('error' in auth) return auth.error
  const parsed = notify.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  const db = await createSessionClient()
  const { error } = await db
    .from('notification_settings')
    .update({ email_enabled: v.emailEnabled, whatsapp_enabled: v.whatsappEnabled, reminders_enabled: v.remindersEnabled, salon_alert_email: v.salonAlertEmail.toLowerCase() || null })
    .eq('id', 1)
  if (error) return { ok: false, error: toAppError(error).message }
  refresh()
  return { ok: true, message: 'Notification settings saved.' }
}
