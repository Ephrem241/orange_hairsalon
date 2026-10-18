/** Small helpers shared by every module that writes appointments or customers. */
import type { MutationCtx } from '../_generated/server'
import { MINUTE } from './time'

/** Phone digits in the forms people type: 251912345678, 0912345678, 912345678. */
export function phoneSearchTokens(phoneE164: string): string[] {
  const digits = phoneE164.replace(/\D/g, '')
  const last9 = digits.slice(-9)
  return [...new Set([digits, `0${last9}`, last9])]
}

export const customerSearchText = (fullName: string, phoneE164: string, email?: string) =>
  [fullName, ...phoneSearchTokens(phoneE164), email ?? ''].join(' ').trim()

export const appointmentSearchText = (customerName: string, customerPhone: string, reference: string) =>
  [customerName, ...phoneSearchTokens(customerPhone), reference].join(' ')

/** ends_at / blocked_until, which the old database trigger derived on every write. */
export function derivedTimes(startsAt: number, durationMin: number, bufferMin: number) {
  const endsAt = startsAt + durationMin * MINUTE
  return { endsAt, blockedUntil: endsAt + bufferMin * MINUTE }
}

// "OS-" + 6 characters from an alphabet without 0/O, 1/I/L.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

function drawReference(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  let code = 'OS-'
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length]
  return code
}

/** A reference no other appointment uses. */
export async function newReference(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const reference = drawReference()
    const taken = await ctx.db
      .query('appointments')
      .withIndex('by_reference', (q) => q.eq('reference', reference))
      .first()
    if (!taken) return reference
  }
  throw new Error('Could not allocate a booking reference')
}
