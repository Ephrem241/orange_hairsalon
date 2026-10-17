import { describe, expect, it } from 'vitest'
import { dispatch } from '@/lib/notifications/dispatch'
import { ResendEmailProvider, WhatsAppCloudProvider } from '@/lib/notifications/providers'
import { buildEmail } from '@/lib/notifications/templates'
import type { LogEntry, NotificationLogStore, NotificationProvider, NotificationStatus, OutgoingMessage, SendResult } from '@/lib/notifications/types'

type Row = { id: string; status: NotificationStatus; attempts: number; error?: string | null; providerMessageId?: string | null; dedupeKey: string | null }

function memoryLog() {
  const rows: Row[] = []
  const store: NotificationLogStore = {
    async create(entry) {
      if (entry.dedupeKey && rows.some((r) => r.dedupeKey === entry.dedupeKey)) return null
      const id = `log-${rows.length + 1}`
      rows.push({ id, status: entry.status, attempts: 0, dedupeKey: entry.dedupeKey })
      return id
    },
    async update(id, patch) {
      const row = rows.find((r) => r.id === id)!
      row.status = patch.status
      if (patch.error !== undefined) row.error = patch.error
      if (patch.providerMessageId !== undefined) row.providerMessageId = patch.providerMessageId
      if (patch.incrementAttempts) row.attempts++
    },
  }
  return { rows, store }
}

const provider = (behaviour: () => Promise<SendResult>, unavailable: string | null = null): NotificationProvider => ({
  channel: 'email',
  name: 'fake',
  unavailableReason: () => unavailable,
  send: behaviour,
})

const entry: LogEntry = { appointmentId: 'a1', event: 'confirmed', channel: 'email', recipient: 'hana@example.com', dedupeKey: 'confirmed:a1:email' }
const message: OutgoingMessage = { channel: 'email', to: 'hana@example.com', subject: 'Hi', text: 'Hi' }

describe('notification dispatch', () => {
  it('records sent only after the provider accepts the message', async () => {
    const { rows, store } = memoryLog()
    const outcome = await dispatch(entry, message, { providers: { email: provider(async () => ({ ok: true, providerMessageId: 'msg_1' })) }, log: store })
    expect(outcome.status).toBe('sent')
    expect(rows[0]).toMatchObject({ status: 'sent', attempts: 1, providerMessageId: 'msg_1' })
  })

  it('records a provider rejection as failed, with the reason', async () => {
    const { rows, store } = memoryLog()
    const outcome = await dispatch(entry, message, { providers: { email: provider(async () => ({ ok: false, error: 'Resend 422: invalid from' })) }, log: store })
    expect(outcome.status).toBe('failed')
    expect(rows[0]).toMatchObject({ status: 'failed', error: 'Resend 422: invalid from', attempts: 1 })
  })

  it('records network errors as failed rather than crashing', async () => {
    const { rows, store } = memoryLog()
    const outcome = await dispatch(entry, message, {
      providers: { email: provider(async () => { throw new Error('timeout') }) },
      log: store,
    })
    expect(outcome.status).toBe('failed')
    expect(rows[0].status).toBe('failed')
  })

  it('skips — and says why — when the provider is not configured', async () => {
    const { rows, store } = memoryLog()
    let sent = false
    const outcome = await dispatch(entry, message, {
      providers: { email: provider(async () => { sent = true; return { ok: true } }, 'Email is not set up (RESEND_API_KEY missing).') },
      log: store,
    })
    expect(sent).toBe(false)
    expect(outcome).toMatchObject({ status: 'skipped' })
    expect(rows[0]).toMatchObject({ status: 'skipped', error: 'Email is not set up (RESEND_API_KEY missing).', attempts: 0 })
  })

  it('skips when there is no provider for the channel at all', async () => {
    const { rows, store } = memoryLog()
    const outcome = await dispatch({ ...entry, channel: 'whatsapp' }, { ...message, channel: 'whatsapp' }, { providers: {}, log: store })
    expect(outcome.status).toBe('skipped')
    expect(rows[0].status).toBe('skipped')
  })

  it('never sends the same deduplicated message twice', async () => {
    const { rows, store } = memoryLog()
    let sends = 0
    const deps = { providers: { email: provider(async () => { sends++; return { ok: true } }) }, log: store }
    await dispatch(entry, message, deps)
    const second = await dispatch(entry, message, deps)
    expect(second.status).toBe('duplicate')
    expect(sends).toBe(1)
    expect(rows).toHaveLength(1)
  })
})

describe('real providers without credentials', () => {
  it('Resend reports itself unavailable instead of pretending to send', () => {
    expect(new ResendEmailProvider(undefined, undefined).unavailableReason()).toMatch(/RESEND_API_KEY/)
    expect(new ResendEmailProvider('key', undefined).unavailableReason()).toMatch(/EMAIL_FROM/)
    expect(new ResendEmailProvider('key', 'Orange Salon <hello@example.com>').unavailableReason()).toBeNull()
  })

  it('WhatsApp requires credentials and an approved template', () => {
    expect(new WhatsAppCloudProvider(undefined, undefined).unavailableReason(message)).toMatch(/not set up/)
    const configured = new WhatsAppCloudProvider('token', '12345')
    expect(configured.unavailableReason({ ...message, channel: 'whatsapp' })).toMatch(/template/)
    expect(
      configured.unavailableReason({ ...message, channel: 'whatsapp', template: { name: 'appointment_confirmed', language: 'en', params: [] } }),
    ).toBeNull()
  })
})

describe('email templates', () => {
  it('escapes customer-supplied text in HTML', () => {
    const email = buildEmail(
      'requested',
      {
        reference: 'OS-7K4M2P', serviceName: 'Silk press', stylistName: null, startsAt: '2026-10-19T05:00:00.000Z',
        customerName: '<script>alert(1)</script>', priceEtb: 1500, priceType: 'fixed', cancelReason: null,
      },
      { name: 'Orange Salon', phone: '+251912419748', address: 'Ednamoll Street, Addis Ababa', siteUrl: 'https://example.com' },
    )
    expect(email.html).not.toContain('<script>alert(1)</script>')
    expect(email.html).toContain('&lt;script&gt;')
    expect(email.text).toContain('Time: 8:00 AM')
    expect(email.text).toContain('ETB 1,500')
    expect(email.subject).toContain('OS-7K4M2P')
  })
})
