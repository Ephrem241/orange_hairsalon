import { formatDateLong, formatTime } from '@/lib/time'
import { formatEtb, formatPhone } from '@/lib/format'
import type { NotificationEvent } from './types'

export type AppointmentContext = {
  reference: string
  serviceName: string
  stylistName: string | null
  startsAt: string
  customerName: string
  priceEtb: number
  priceType: 'fixed' | 'from'
  cancelReason: string | null
}

export type SalonContext = { name: string; phone: string | null; address: string; siteUrl: string }

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const HEADLINES: Record<NotificationEvent, (a: AppointmentContext) => { subject: string; intro: string }> = {
  requested: (a) => ({
    subject: `We’ve received your booking request (${a.reference})`,
    intro: 'Thank you for booking with us. Your appointment is requested — our team will confirm it shortly.',
  }),
  confirmed: (a) => ({ subject: `Your appointment is confirmed (${a.reference})`, intro: 'Good news — your appointment is confirmed. We look forward to seeing you.' }),
  rescheduled: (a) => ({ subject: `Your appointment has moved (${a.reference})`, intro: 'Your appointment has been rescheduled. Here are the new details.' }),
  cancelled: (a) => ({
    subject: `Your appointment has been cancelled (${a.reference})`,
    intro: a.cancelReason ? `Your appointment has been cancelled. Reason: ${a.cancelReason}` : 'Your appointment has been cancelled.',
  }),
  reminder: (a) => ({ subject: `Reminder: your appointment tomorrow (${a.reference})`, intro: 'A friendly reminder of your upcoming appointment.' }),
  salon_alert: (a) => ({ subject: `New booking request ${a.reference} — ${a.serviceName}`, intro: `${a.customerName} has requested an appointment.` }),
}

export function buildEmail(event: NotificationEvent, a: AppointmentContext, salon: SalonContext) {
  const { subject, intro } = HEADLINES[event](a)
  const rows: [string, string][] = [
    ['Reference', a.reference],
    ['Service', a.serviceName],
    ...(a.stylistName ? ([['Stylist', a.stylistName]] as [string, string][]) : []),
    ['Date', formatDateLong(a.startsAt)],
    ['Time', formatTime(a.startsAt)],
    ['Price', `${formatEtb(a.priceEtb, a.priceType)} (paid at the salon)`],
  ]
  const manageUrl = `${salon.siteUrl}/booking/manage`
  const contact = [salon.address, salon.phone ? formatPhone(salon.phone) : null].filter(Boolean).join(' · ')
  const greeting = event === 'salon_alert' ? 'Hello team,' : `Hello ${a.customerName},`

  const text = [
    greeting,
    '',
    intro,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    event === 'salon_alert'
      ? `Review it in the dashboard: ${salon.siteUrl}/admin/appointments`
      : `View or change your booking: ${manageUrl} (you’ll need your reference and phone number).`,
    '',
    salon.name,
    contact,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;background:#f8f3ec;font-family:Helvetica,Arial,sans-serif;color:#171513">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f3ec;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:2px">
<tr><td style="background:#171513;padding:28px 32px;text-align:center"><div style="font-family:Georgia,serif;font-size:24px;letter-spacing:4px;color:#c98545">ORANGE</div><div style="font-size:10px;letter-spacing:8px;color:#f8f3ec;margin-top:4px">SALON</div></td></tr>
<tr><td style="padding:32px">
<p style="margin:0 0 12px;font-size:15px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6">${escapeHtml(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e6dacb">
${rows.map(([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e6dacb;font-size:13px;color:#6b6054;width:110px">${escapeHtml(k)}</td><td style="padding:10px 0;border-bottom:1px solid #e6dacb;font-size:14px">${escapeHtml(v)}</td></tr>`).join('')}
</table>
<p style="margin:28px 0 0"><a href="${escapeHtml(event === 'salon_alert' ? `${salon.siteUrl}/admin/appointments` : manageUrl)}" style="display:inline-block;background:#c98545;color:#171513;text-decoration:none;padding:12px 22px;border-radius:2px;font-size:14px">${event === 'salon_alert' ? 'Open the dashboard' : 'View your booking'}</a></p>
</td></tr>
<tr><td style="padding:20px 32px;background:#f1e9de;font-size:12px;color:#6b6054">${escapeHtml(salon.name)}${contact ? ` · ${escapeHtml(contact)}` : ''}</td></tr>
</table></td></tr></table></body></html>`

  return { subject, text, html }
}

/** Parameters for the WhatsApp templates: {{1}} name, {{2}} service, {{3}} date, {{4}} time, {{5}} reference. */
export function whatsappParams(a: AppointmentContext): string[] {
  return [a.customerName, a.serviceName, formatDateLong(a.startsAt), formatTime(a.startsAt), a.reference]
}
