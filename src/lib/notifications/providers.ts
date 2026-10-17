import type { NotificationEvent, NotificationProvider, OutgoingMessage, SendResult } from './types'

const TIMEOUT_MS = 10_000

async function postJson(url: string, token: string, body: unknown): Promise<{ ok: boolean; status: number; json: unknown }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    // non-JSON error bodies are reported by status code
  }
  return { ok: response.ok, status: response.status, json }
}

/** Email through Resend (https://resend.com). Needs RESEND_API_KEY and a verified EMAIL_FROM domain. */
export class ResendEmailProvider implements NotificationProvider {
  readonly channel = 'email' as const
  readonly name = 'resend'
  constructor(private readonly apiKey = process.env.RESEND_API_KEY, private readonly from = process.env.EMAIL_FROM) {}

  unavailableReason(): string | null {
    if (!this.apiKey) return 'Email is not set up (RESEND_API_KEY missing).'
    if (!this.from) return 'Email is not set up (EMAIL_FROM missing).'
    return null
  }

  async send(message: OutgoingMessage): Promise<SendResult> {
    const { ok, status, json } = await postJson('https://api.resend.com/emails', this.apiKey!, {
      from: this.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
    const body = json as { id?: string; message?: string } | null
    if (ok && body?.id) return { ok: true, providerMessageId: body.id }
    return { ok: false, error: `Resend ${status}: ${body?.message ?? 'request failed'}` }
  }
}

/**
 * WhatsApp Business Platform (Cloud API). Business-initiated messages must use
 * templates approved in Meta Business Manager, configured per event through
 * WHATSAPP_TEMPLATE_<EVENT> (e.g. WHATSAPP_TEMPLATE_CONFIRMED=appointment_confirmed).
 * A wa.me click-to-chat link is not a notification channel and is never used here.
 */
export class WhatsAppCloudProvider implements NotificationProvider {
  readonly channel = 'whatsapp' as const
  readonly name = 'whatsapp-cloud'
  constructor(
    private readonly token = process.env.WHATSAPP_ACCESS_TOKEN,
    private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID,
    private readonly apiVersion = process.env.WHATSAPP_API_VERSION ?? 'v22.0',
  ) {}

  unavailableReason(message: OutgoingMessage): string | null {
    if (!this.token || !this.phoneNumberId) return 'WhatsApp Business is not set up (access token or phone number ID missing).'
    if (!message.template) return 'No approved WhatsApp template is configured for this message.'
    return null
  }

  async send(message: OutgoingMessage): Promise<SendResult> {
    const t = message.template!
    const { ok, status, json } = await postJson(
      `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
      this.token!,
      {
        messaging_product: 'whatsapp',
        to: message.to.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: t.name,
          language: { code: t.language },
          components: [{ type: 'body', parameters: t.params.map((text) => ({ type: 'text', text })) }],
        },
      },
    )
    const body = json as { messages?: { id: string }[]; error?: { message?: string } } | null
    const id = body?.messages?.[0]?.id
    if (ok && id) return { ok: true, providerMessageId: id }
    return { ok: false, error: `WhatsApp ${status}: ${body?.error?.message ?? 'request failed'}` }
  }
}

/** Template name configured for an event, if any. */
export function whatsappTemplateFor(event: NotificationEvent): string | null {
  return process.env[`WHATSAPP_TEMPLATE_${event.toUpperCase()}`] || null
}
