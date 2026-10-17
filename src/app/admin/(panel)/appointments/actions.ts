'use server'

import { refresh } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { authorize, FRONT_DESK, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { notifyAppointment } from '@/lib/notifications/notify'
import { normalizePhone } from '@/lib/phone'
import { createSessionClient } from '@/lib/supabase/server'
import type { AppointmentStatus } from '@/lib/types'

const statusInput = z.object({
  id: z.uuid(),
  status: z.enum(['confirmed', 'cancelled', 'completed', 'no_show']),
  reason: z.string().trim().max(500).optional(),
  amountPaidEtb: z.number().int().min(0).max(1_000_000).nullable().optional(),
})

export async function setAppointmentStatus(input: z.input<typeof statusInput>): Promise<ActionResult> {
  const auth = await authorize(FRONT_DESK)
  if ('error' in auth) return auth.error
  const parsed = statusInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const { id, status, reason, amountPaidEtb } = parsed.data

  const db = await createSessionClient()
  const { error } = await db.rpc('set_appointment_status', {
    p_appointment_id: id,
    p_status: status,
    p_reason: reason || null,
    p_amount_paid_etb: status === 'completed' ? (amountPaidEtb ?? null) : null,
  })
  if (error) return { ok: false, error: toAppError(error).message }

  if (status === 'confirmed' || status === 'cancelled') after(() => notifyAppointment(id, status))
  refresh()
  const labels: Record<string, string> = {
    confirmed: 'Appointment confirmed.',
    cancelled: 'Appointment cancelled.',
    completed: 'Marked as completed.',
    no_show: 'Marked as no-show.',
  }
  return { ok: true, message: labels[status] }
}

const rescheduleInput = z.object({ id: z.uuid(), startsAt: z.iso.datetime({ offset: true }), stylistId: z.uuid().nullable() })

export async function rescheduleAppointment(input: z.input<typeof rescheduleInput>): Promise<ActionResult> {
  const auth = await authorize(FRONT_DESK)
  if ('error' in auth) return auth.error
  const parsed = rescheduleInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Choose a new time.' }
  const db = await createSessionClient()
  const { error } = await db.rpc('reschedule_appointment', {
    p_appointment_id: parsed.data.id,
    p_new_start: parsed.data.startsAt,
    p_new_stylist_id: parsed.data.stylistId,
  })
  if (error) return { ok: false, error: toAppError(error).message }
  after(() => notifyAppointment(parsed.data.id, 'rescheduled'))
  refresh()
  return { ok: true, message: 'Appointment rescheduled.' }
}

export async function updateAppointmentNotes(id: string, notes: string): Promise<ActionResult> {
  const auth = await authorize(FRONT_DESK)
  if ('error' in auth) return auth.error
  if (!z.uuid().safeParse(id).success || notes.length > 2000) return { ok: false, error: 'Notes can be up to 2000 characters.' }
  const db = await createSessionClient()
  const { error } = await db.rpc('update_appointment_notes', { p_appointment_id: id, p_notes: notes })
  if (error) return { ok: false, error: toAppError(error).message }
  refresh()
  return { ok: true, message: 'Notes saved.' }
}

export type StaffSlot = { startsAt: string; stylistId: string }

/** Free times for a service on a date (optionally one stylist), ignoring an appointment being moved. */
export async function findStaffSlots(input: { serviceId: string; stylistId: string | null; date: string; ignoreId?: string | null }): Promise<ActionResult<StaffSlot[]>> {
  const auth = await authorize(FRONT_DESK)
  if ('error' in auth) return auth.error
  const db = await createSessionClient()
  const { data, error } = await db.rpc('staff_available_slots', {
    p_service_id: input.serviceId,
    p_stylist_id: input.stylistId,
    p_date: input.date,
    p_ignore_appointment: input.ignoreId ?? null,
  })
  if (error) return { ok: false, error: toAppError(error).message }
  return {
    ok: true,
    data: (data as { slot_start: string; slot_stylist_id: string }[]).map((s) => ({
      startsAt: new Date(s.slot_start).toISOString(),
      stylistId: s.slot_stylist_id,
    })),
  }
}

const createInput = z.object({
  serviceId: z.uuid('Choose a service.'),
  stylistId: z.uuid().nullable(),
  startsAt: z.iso.datetime({ offset: true, message: 'Choose a time.' }),
  fullName: z.string().trim().min(2, 'Enter the client’s name.').max(120),
  phone: z.string().trim().min(1, 'Enter the client’s phone number.'),
  email: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
  source: z.enum(['phone', 'walk_in']),
  confirm: z.boolean(),
})

export async function createAppointment(input: z.input<typeof createInput>): Promise<ActionResult<{ id: string; reference: string }>> {
  const auth = await authorize(FRONT_DESK)
  if ('error' in auth) return auth.error
  const parsed = createInput.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue.message, fields: { [String(issue.path[0])]: issue.message } }
  }
  const v = parsed.data
  const phone = normalizePhone(v.phone)
  if (!phone) return { ok: false, error: 'Enter a valid phone number.', fields: { phone: 'Enter a valid phone number.' } }

  const db = await createSessionClient()
  const { data, error } = await db.rpc('staff_create_appointment', {
    p_service_id: v.serviceId,
    p_stylist_id: v.stylistId,
    p_starts_at: v.startsAt,
    p_full_name: v.fullName,
    p_phone: phone,
    p_email: v.email || null,
    p_notes: v.notes || null,
    p_source: v.source,
    p_confirm: v.confirm,
  })
  if (error) return { ok: false, error: toAppError(error).message }
  const row = data as { appointment_id: string; reference: string; status: AppointmentStatus }
  after(() => notifyAppointment(row.appointment_id, row.status === 'confirmed' ? 'confirmed' : 'requested'))
  return { ok: true, message: `Booked — reference ${row.reference}.`, data: { id: row.appointment_id, reference: row.reference } }
}
