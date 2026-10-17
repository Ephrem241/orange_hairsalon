import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
process.env.BOOKING_COOKIE_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars'

const { openBookingAccess, sealBookingAccess, BOOKING_ACCESS_TTL_SECONDS } = await import('@/lib/booking/access')
const { bookingRequestSchema, contactSchema, lookupSchema } = await import('@/lib/validation')
const { toAppError } = await import('@/lib/booking/errors')

describe('booking access cookie', () => {
  it('round-trips the reference and phone', () => {
    const token = sealBookingAccess('OS-7K4M2P', '+251912419748')
    expect(openBookingAccess(token)).toMatchObject({ reference: 'OS-7K4M2P', phone: '+251912419748' })
  })

  it('does not expose the phone number in the cookie value', () => {
    const token = sealBookingAccess('OS-7K4M2P', '+251912419748')
    expect(token).not.toContain('912419748')
    expect(Buffer.from(token.split('.')[2], 'base64url').toString()).not.toContain('912419748')
  })

  it('rejects tampered or truncated tokens', () => {
    const token = sealBookingAccess('OS-7K4M2P', '+251912419748')
    const [iv, tag, body] = token.split('.')
    const flipped = Buffer.from(body, 'base64url')
    flipped[0] ^= 1
    expect(openBookingAccess(`${iv}.${tag}.${flipped.toString('base64url')}`)).toBeNull()
    expect(openBookingAccess(`${iv}.${tag}`)).toBeNull()
    expect(openBookingAccess('garbage')).toBeNull()
    expect(openBookingAccess(undefined)).toBeNull()
  })

  it('expires after the access window', () => {
    const issued = Date.now()
    const token = sealBookingAccess('OS-7K4M2P', '+251912419748', issued)
    expect(openBookingAccess(token, issued + (BOOKING_ACCESS_TTL_SECONDS - 5) * 1000)).not.toBeNull()
    expect(openBookingAccess(token, issued + (BOOKING_ACCESS_TTL_SECONDS + 5) * 1000)).toBeNull()
  })

  it('rejects tokens sealed with another secret', async () => {
    const token = sealBookingAccess('OS-7K4M2P', '+251912419748')
    process.env.BOOKING_COOKIE_SECRET = 'a-completely-different-secret-of-sufficient-length'
    try {
      expect(openBookingAccess(token)).toBeNull()
    } finally {
      process.env.BOOKING_COOKIE_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars'
    }
  })
})

describe('request validation', () => {
  const valid = {
    serviceId: '00000000-0000-4000-8000-000000000001',
    stylistId: null,
    startsAt: '2026-10-19T05:00:00.000Z',
    fullName: '  Hana Tesfaye ',
    phone: '0911 22 33 44',
    email: 'HANA@Example.com',
    notes: '',
    policyAccepted: true,
  }

  it('normalises a valid booking request', () => {
    const parsed = bookingRequestSchema.parse(valid)
    expect(parsed).toMatchObject({ fullName: 'Hana Tesfaye', phone: '+251911223344', email: 'hana@example.com' })
  })

  it('requires policy acceptance and a reachable phone', () => {
    expect(bookingRequestSchema.safeParse({ ...valid, policyAccepted: false }).success).toBe(false)
    expect(bookingRequestSchema.safeParse({ ...valid, phone: '12' }).success).toBe(false)
  })

  it('treats a filled honeypot as invalid', () => {
    expect(bookingRequestSchema.safeParse({ ...valid, website: 'http://spam' }).success).toBe(false)
  })

  it('accepts references in any case and with or without the dash', () => {
    expect(lookupSchema.parse({ reference: 'os7k4m2p', phone: '0912419748' }).reference).toBe('OS-7K4M2P')
    expect(lookupSchema.safeParse({ reference: 'OS-0000O0', phone: '0912419748' }).success).toBe(false)
  })

  it('needs a phone or email on the contact form', () => {
    expect(contactSchema.safeParse({ fullName: 'Hana', phone: '', email: '', message: 'Hello there' }).success).toBe(false)
    expect(contactSchema.safeParse({ fullName: 'Hana', phone: '', email: 'h@example.com', message: 'Hello there' }).success).toBe(true)
  })
})

describe('engine error mapping', () => {
  it('maps engine codes to actionable responses', () => {
    expect(toAppError({ message: 'SLOT_TAKEN' })).toMatchObject({ code: 'SLOT_TAKEN', status: 409 })
    expect(toAppError({ message: 'PAST_CUTOFF' }).message).toMatch(/call the salon/)
    expect(toAppError({ message: 'permission denied for function x', code: '42501' })).toMatchObject({ code: 'FORBIDDEN', status: 403 })
  })

  it('never leaks unexpected database errors', () => {
    const err = toAppError({ message: 'duplicate key value violates unique constraint "customers_pkey"' })
    expect(err).toMatchObject({ code: 'UNKNOWN', status: 500 })
    expect(err.message).not.toMatch(/constraint/)
  })
})
