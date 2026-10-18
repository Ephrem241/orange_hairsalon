'use server'

import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { refresh } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { authorize, FRONT_DESK, type ActionResult } from '@/lib/auth/staff'
import { toAppError } from '@/lib/booking/errors'
import { staffMutation, staffQuery } from '@/lib/convex/server'
import { notifyAppointment } from '@/lib/notifications/notify'
import { normalizePhone } from '@/lib/phone'
import { convexId } from '@/lib/validation'

const statusInput = z.object({
  id: convexId(),
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

  try {
    await staffMutation(api.appointments.setStatus, {
      id: id as Id<'appointments'>,
      status,
      reason: reason || undefined,
      amountPaidEtb: status === 'completed' ? (amountPaidEtb ?? undefined) : undefined,
    })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }

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

const rescheduleInput = z.object({ id: convexId(), startsAt: z.iso.datetime({ offset: true }), stylistId: convexId().nullable() })

export async function rescheduleAppointment(input: z.input<typeof rescheduleInput>): Promise<ActionResult> {
  const auth = await authorize(FRONT_DESK)
  if ('error' in auth) return auth.error
  const parsed = rescheduleInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Choose a new time.' }
  try {
    await staffMutation(api.appointments.reschedule, {
      id: parsed.data.id as Id<'appointments'>,
      startsAt: Date.parse(parsed.data.startsAt),
      stylistId: parsed.data.stylistId as Id<'stylists'> | null,
    })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  after(() => notifyAppointment(parsed.data.id, 'rescheduled'))
  refresh()
  return { ok: true, message: 'Appointment rescheduled.' }
}

export async function updateAppointmentNotes(id: string, notes: string): Promise<ActionResult> {
  const auth = await authorize(FRONT_DESK)
  if ('error' in auth) return auth.error
  if (!convexId().safeParse(id).success || notes.length > 2000) return { ok: false, error: 'Notes can be up to 2000 characters.' }
  try {
    await staffMutation(api.appointments.updateNotes, { id: id as Id<'appointments'>, notes })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  refresh()
  return { ok: true, message: 'Notes saved.' }
}

export type StaffSlot = { startsAt: string; stylistId: string }

/** Free times for a service on a date (optionally one stylist), ignoring an appointment being moved. */
export async function findStaffSlots(input: { serviceId: string; stylistId: string | null; date: string; ignoreId?: string | null }): Promise<ActionResult<StaffSlot[]>> {
  const auth = await authorize(FRONT_DESK)
  if ('error' in auth) return auth.error
  try {
    const slots = await staffQuery(api.appointments.staffSlots, {
      serviceId: input.serviceId as Id<'services'>,
      stylistId: input.stylistId as Id<'stylists'> | null,
      date: input.date,
      ignoreId: (input.ignoreId ?? undefined) as Id<'appointments'> | undefined,
      now: Date.now(),
    })
    return { ok: true, data: slots.map((s) => ({ startsAt: new Date(s.startsAt).toISOString(), stylistId: s.stylistId })) }
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
}

const createInput = z.object({
  serviceId: convexId('Choose a service.'),
  stylistId: convexId().nullable(),
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

  let row
  try {
    row = await staffMutation(api.appointments.create, {
      serviceId: v.serviceId as Id<'services'>,
      stylistId: v.stylistId as Id<'stylists'> | null,
      startsAt: Date.parse(v.startsAt),
      fullName: v.fullName,
      phone,
      email: v.email || undefined,
      notes: v.notes || undefined,
      source: v.source,
      confirm: v.confirm,
    })
  } catch (error) {
    return { ok: false, error: toAppError(error).message }
  }
  const { appointmentId, reference, status } = row
  after(() => notifyAppointment(appointmentId, status === 'confirmed' ? 'confirmed' : 'requested'))
  return { ok: true, message: `Booked — reference ${reference}.`, data: { id: appointmentId, reference } }
}
