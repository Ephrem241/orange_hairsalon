export type NotificationEvent = 'requested' | 'confirmed' | 'rescheduled' | 'cancelled' | 'reminder' | 'salon_alert'
export type NotificationChannel = 'email' | 'whatsapp'
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export type OutgoingMessage = {
  channel: NotificationChannel
  to: string
  subject?: string
  text: string
  html?: string
  /** WhatsApp business-initiated messages must use a pre-approved template. */
  template?: { name: string; language: string; params: string[] }
}

export type SendResult = { ok: true; providerMessageId?: string } | { ok: false; error: string }

/** A delivery provider. Swap or add providers without touching the dispatcher. */
export interface NotificationProvider {
  readonly channel: NotificationChannel
  readonly name: string
  /** Why this message cannot be sent (missing credentials, template…), or null when it can. */
  unavailableReason(message: OutgoingMessage): string | null
  send(message: OutgoingMessage): Promise<SendResult>
}

export type LogEntry = {
  appointmentId: string | null
  event: NotificationEvent
  channel: NotificationChannel
  recipient: string
  dedupeKey: string | null
}

export interface NotificationLogStore {
  /** Returns the new row id, or null when the dedupe key already exists. */
  create(entry: LogEntry & { status: NotificationStatus; provider: string | null }): Promise<string | null>
  update(
    id: string,
    patch: { status: NotificationStatus; providerMessageId?: string | null; error?: string | null; incrementAttempts?: boolean },
  ): Promise<void>
}

export type DispatchOutcome = { status: NotificationStatus | 'duplicate'; logId: string | null; error?: string }
