import 'server-only'
import { siteUrl } from '@/config/site'
import type { Id } from '@convex/_generated/dataModel'
import { api } from '@convex/_generated/api'
import { isServerDataConfigured, serverMutation, serverQuery } from '@/lib/convex/server'
import { deliver, dispatch } from './dispatch'
import { ResendEmailProvider, WhatsAppCloudProvider, whatsappTemplateFor } from './providers'
import { buildEmail, whatsappParams, type AppointmentContext, type SalonContext } from './templates'
import type { DispatchOutcome, NotificationChannel, NotificationEvent, NotificationLogStore, NotificationProvider, OutgoingMessage } from './types'

const providers: Record<NotificationChannel, NotificationProvider> = {
  email: new ResendEmailProvider(),
  whatsapp: new WhatsAppCloudProvider(),
}

function convexLogStore(): NotificationLogStore {
  return {
    async create(entry) {
      return await serverMutation(api.notifications.logCreate, {
        appointmentId: entry.appointmentId as Id<'appointments'> | null,
        event: entry.event,
        channel: entry.channel,
        recipient: entry.recipient,
        dedupeKey: entry.dedupeKey,
        status: entry.status,
        provider: entry.provider,
      })
    },
    async update(id, patch) {
      try {
        await serverMutation(api.notifications.logUpdate, { id: id as Id<'notificationLog'>, ...patch })
      } catch (error) {
        console.error('[notify] could not update log', id, (error as Error).message)
      }
    },
  }
}

type Loaded = {
  appointment: AppointmentContext & { id: string; email: string | null; phone: string }
  salon: SalonContext
  prefs: { emailEnabled: boolean; whatsappEnabled: boolean; salonAlertEmail: string | null; remindersEnabled: boolean }
}

async function load(appointmentId: string): Promise<Loaded | null> {
  const ctx = await serverQuery(api.notifications.context, { appointmentId: appointmentId as Id<'appointments'> })
  if (!ctx) return null
  const { appointment: a, salon: s } = ctx
  return {
    appointment: { ...a, startsAt: new Date(a.startsAt).toISOString() },
    salon: {
      name: s.name,
      phone: s.phone,
      address: [s.addressLine, s.city].filter(Boolean).join(', '),
      siteUrl,
    },
    prefs: ctx.prefs,
  }
}

function messageFor(event: NotificationEvent, channel: NotificationChannel, to: string, ctx: Loaded): OutgoingMessage {
  if (channel === 'email') return { channel, to, ...buildEmail(event, ctx.appointment, ctx.salon) }
  const template = whatsappTemplateFor(event)
  const email = buildEmail(event, ctx.appointment, ctx.salon)
  return {
    channel,
    to,
    text: email.text,
    template: template ? { name: template, language: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'en', params: whatsappParams(ctx.appointment) } : undefined,
  }
}

/**
 * Send every notification an appointment event calls for, according to the
 * salon's notification settings. Each attempt is logged; nothing is reported
 * as sent unless a provider accepted it. Safe to call in `after()`.
 */
export async function notifyAppointment(
  appointmentId: string,
  event: Exclude<NotificationEvent, 'salon_alert'>,
): Promise<DispatchOutcome[]> {
  if (!isServerDataConfigured) return []
  try {
    const ctx = await load(appointmentId)
    if (!ctx) return []
    const log = convexLogStore()
    const a = ctx.appointment
    // Events that can happen once per appointment are deduplicated; reschedules
    // and reminders are keyed on the appointment time they refer to.
    const key = (channel: NotificationChannel, kind: NotificationEvent = event) =>
      kind === 'rescheduled' || kind === 'reminder' ? `${kind}:${a.id}:${channel}:${a.startsAt}` : `${kind}:${a.id}:${channel}`

    const jobs: Promise<DispatchOutcome>[] = []
    if (event === 'reminder' && !ctx.prefs.remindersEnabled) return []
    if (ctx.prefs.emailEnabled && a.email) {
      jobs.push(dispatch({ appointmentId: a.id, event, channel: 'email', recipient: a.email, dedupeKey: key('email') }, messageFor(event, 'email', a.email, ctx), { providers, log }))
    }
    if (ctx.prefs.whatsappEnabled) {
      jobs.push(dispatch({ appointmentId: a.id, event, channel: 'whatsapp', recipient: a.phone, dedupeKey: key('whatsapp') }, messageFor(event, 'whatsapp', a.phone, ctx), { providers, log }))
    }
    if (event === 'requested' && ctx.prefs.emailEnabled && ctx.prefs.salonAlertEmail) {
      const to = ctx.prefs.salonAlertEmail
      jobs.push(dispatch({ appointmentId: a.id, event: 'salon_alert', channel: 'email', recipient: to, dedupeKey: key('email', 'salon_alert') }, messageFor('salon_alert', 'email', to, ctx), { providers, log }))
    }
    return await Promise.all(jobs)
  } catch (error) {
    console.error('[notify] failed to process', event, appointmentId, (error as Error).message)
    return []
  }
}

/** Re-send a logged notification (dashboard "Retry"). */
export async function retryNotification(logId: string): Promise<DispatchOutcome> {
  const row = await serverQuery(api.notifications.logEntry, { id: logId as Id<'notificationLog'> })
  if (!row?.appointmentId) return { status: 'failed', logId, error: 'Notification not found.' }
  const ctx = await load(row.appointmentId)
  if (!ctx) return { status: 'failed', logId, error: 'Appointment not found.' }
  const log = convexLogStore()
  const message = messageFor(row.event, row.channel, row.recipient, ctx)
  const provider = providers[row.channel as NotificationChannel]
  const unavailable = provider.unavailableReason(message)
  if (unavailable) {
    await log.update(logId, { status: 'skipped', error: unavailable })
    return { status: 'skipped', logId, error: unavailable }
  }
  return deliver(logId, message, provider, log)
}
