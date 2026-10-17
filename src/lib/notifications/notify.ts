import 'server-only'
import { siteUrl } from '@/config/site'
import { createAdminClient, isServerDataConfigured } from '@/lib/supabase/admin'
import { deliver, dispatch } from './dispatch'
import { ResendEmailProvider, WhatsAppCloudProvider, whatsappTemplateFor } from './providers'
import { buildEmail, whatsappParams, type AppointmentContext, type SalonContext } from './templates'
import type { DispatchOutcome, NotificationChannel, NotificationEvent, NotificationLogStore, NotificationProvider, OutgoingMessage } from './types'

const providers: Record<NotificationChannel, NotificationProvider> = {
  email: new ResendEmailProvider(),
  whatsapp: new WhatsAppCloudProvider(),
}

function supabaseLogStore(): NotificationLogStore {
  const db = createAdminClient()
  return {
    async create(entry) {
      const { data, error } = await db
        .from('notification_log')
        .insert({
          appointment_id: entry.appointmentId,
          event: entry.event,
          channel: entry.channel,
          recipient: entry.recipient,
          dedupe_key: entry.dedupeKey,
          status: entry.status,
          provider: entry.provider,
        })
        .select('id')
        .single()
      if (error) {
        if (error.code === '23505') return null // already sent for this dedupe key
        throw new Error(`notification_log insert failed: ${error.message}`)
      }
      return data.id as string
    },
    async update(id, patch) {
      let attempts: number | undefined
      if (patch.incrementAttempts) {
        const { data } = await db.from('notification_log').select('attempts').eq('id', id).single()
        attempts = ((data?.attempts as number | undefined) ?? 0) + 1
      }
      const { error } = await db
        .from('notification_log')
        .update({
          status: patch.status,
          ...(patch.providerMessageId !== undefined ? { provider_message_id: patch.providerMessageId } : {}),
          ...(patch.error !== undefined ? { error: patch.error } : {}),
          ...(attempts !== undefined ? { attempts } : {}),
          ...(patch.status === 'sent' ? { sent_at: new Date().toISOString() } : {}),
        })
        .eq('id', id)
      if (error) console.error('[notify] could not update log', id, error.message)
    },
  }
}

type Loaded = {
  appointment: AppointmentContext & { id: string; email: string | null; phone: string }
  salon: SalonContext
  prefs: { emailEnabled: boolean; whatsappEnabled: boolean; salonAlertEmail: string | null; remindersEnabled: boolean }
}

async function load(appointmentId: string): Promise<Loaded | null> {
  const db = createAdminClient()
  const [{ data: a }, { data: s }, { data: n }] = await Promise.all([
    db
      .from('appointments')
      .select('id, reference, service_name, starts_at, customer_name, customer_email, customer_phone, price_etb, price_type, cancel_reason, stylist:stylists(display_name)')
      .eq('id', appointmentId)
      .maybeSingle(),
    db.from('business_settings').select('name, phone, address_line, city').eq('id', 1).maybeSingle(),
    db.from('notification_settings').select('*').eq('id', 1).maybeSingle(),
  ])
  if (!a || !s) return null
  const stylist = a.stylist as { display_name?: string } | null
  return {
    appointment: {
      id: a.id,
      reference: a.reference,
      serviceName: a.service_name,
      stylistName: stylist?.display_name ?? null,
      startsAt: a.starts_at,
      customerName: a.customer_name,
      priceEtb: a.price_etb,
      priceType: a.price_type,
      cancelReason: a.cancel_reason,
      email: a.customer_email,
      phone: a.customer_phone,
    },
    salon: {
      name: s.name,
      phone: s.phone,
      address: [s.address_line, s.city].filter(Boolean).join(', '),
      siteUrl,
    },
    prefs: {
      emailEnabled: n?.email_enabled ?? true,
      whatsappEnabled: n?.whatsapp_enabled ?? false,
      salonAlertEmail: n?.salon_alert_email ?? null,
      remindersEnabled: n?.reminders_enabled ?? true,
    },
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
    const log = supabaseLogStore()
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
  const db = createAdminClient()
  const { data: row } = await db.from('notification_log').select('*').eq('id', logId).maybeSingle()
  if (!row?.appointment_id) return { status: 'failed', logId, error: 'Notification not found.' }
  const ctx = await load(row.appointment_id)
  if (!ctx) return { status: 'failed', logId, error: 'Appointment not found.' }
  const log = supabaseLogStore()
  const message = messageFor(row.event, row.channel, row.recipient, ctx)
  const provider = providers[row.channel as NotificationChannel]
  const unavailable = provider.unavailableReason(message)
  if (unavailable) {
    await log.update(logId, { status: 'skipped', error: unavailable })
    return { status: 'skipped', logId, error: unavailable }
  }
  return deliver(logId, message, provider, log)
}
