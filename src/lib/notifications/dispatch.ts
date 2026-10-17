import type { DispatchOutcome, LogEntry, NotificationChannel, NotificationLogStore, NotificationProvider, OutgoingMessage } from './types'

/**
 * Deliver one message and record the truth about it.
 *
 *   pending → sent     only after the provider accepted the message
 *   pending → failed   the provider rejected it or the request errored
 *   pending → skipped  no provider/credentials/template for this message
 *
 * A dedupe key that already exists short-circuits without sending again.
 */
export async function dispatch(
  entry: LogEntry,
  message: OutgoingMessage,
  deps: { providers: Partial<Record<NotificationChannel, NotificationProvider>>; log: NotificationLogStore },
): Promise<DispatchOutcome> {
  const provider = deps.providers[entry.channel]
  const logId = await deps.log.create({ ...entry, status: 'pending', provider: provider?.name ?? null })
  if (logId === null) return { status: 'duplicate', logId: null }

  const unavailable = provider ? provider.unavailableReason(message) : `No ${entry.channel} provider is set up.`
  if (unavailable) {
    await deps.log.update(logId, { status: 'skipped', error: unavailable })
    return { status: 'skipped', logId, error: unavailable }
  }

  return deliver(logId, message, provider!, deps.log)
}

/** Send (or re-send) against an existing log row. */
export async function deliver(
  logId: string,
  message: OutgoingMessage,
  provider: NotificationProvider,
  log: NotificationLogStore,
): Promise<DispatchOutcome> {
  let result
  try {
    result = await provider.send(message)
  } catch (error) {
    result = { ok: false as const, error: (error as Error).message || 'Unknown error' }
  }
  if (result.ok) {
    await log.update(logId, { status: 'sent', providerMessageId: result.providerMessageId ?? null, error: null, incrementAttempts: true })
    return { status: 'sent', logId }
  }
  await log.update(logId, { status: 'failed', error: result.error.slice(0, 1000), incrementAttempts: true })
  return { status: 'failed', logId, error: result.error }
}
