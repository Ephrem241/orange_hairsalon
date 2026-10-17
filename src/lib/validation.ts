/**
 * Input schemas shared by the browser (instant feedback) and the server (the
 * authority). The database re-validates everything again on insert.
 */
import { z } from 'zod'
import { normalizePhone } from '@/lib/phone'

export const REFERENCE_PATTERN = /^OS-[2-9A-HJKMNP-Z]{6}$/

const phone = z
  .string()
  .trim()
  .min(1, 'Please enter your phone number.')
  .transform((value, ctx) => {
    const normalized = normalizePhone(value)
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Please enter a valid phone number, e.g. 0912 345 678.' })
      return z.NEVER
    }
    return normalized
  })

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .transform((v) => v.toLowerCase())
  .refine((v) => v === '' || z.email().safeParse(v).success, 'Please enter a valid email address.')
  .transform((v) => (v === '' ? null : v))

const fullName = z
  .string()
  .trim()
  .min(2, 'Please enter your full name.')
  .max(120, 'That name is a little long — please shorten it.')

/** Hidden field that real visitors never fill in. */
const honeypot = z.string().max(0).optional()

export const bookingRequestSchema = z.object({
  serviceId: z.uuid('Please choose a service.'),
  stylistId: z.uuid().nullable(),
  startsAt: z.iso.datetime({ offset: true, message: 'Please choose a time.' }),
  fullName,
  phone,
  email: optionalEmail,
  notes: z.string().trim().max(1000, 'Notes can be up to 1000 characters.').default(''),
  policyAccepted: z.literal(true, { message: 'Please accept the booking policy to continue.' }),
  website: honeypot,
})
export type BookingRequest = z.infer<typeof bookingRequestSchema>

export const referenceSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase().replace(/^OS(?=[^-])/, 'OS-'))
  .refine((v) => REFERENCE_PATTERN.test(v), 'Booking references look like OS-7K4M2P.')

export const lookupSchema = z.object({ reference: referenceSchema, phone })

export const cancelSchema = z.object({ reason: z.string().trim().max(500).default('') })

export const rescheduleSchema = z.object({ startsAt: z.iso.datetime({ offset: true, message: 'Please choose a new time.' }) })

export const contactSchema = z
  .object({
    fullName,
    phone: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (value === '') return null
        const normalized = normalizePhone(value)
        if (!normalized) {
          ctx.addIssue({ code: 'custom', message: 'Please enter a valid phone number.' })
          return z.NEVER
        }
        return normalized
      }),
    email: optionalEmail,
    message: z.string().trim().min(5, 'Please write a short message.').max(2000, 'Messages can be up to 2000 characters.'),
    website: honeypot,
  })
  .refine((v) => v.phone || v.email, { message: 'Please give us a phone number or email so we can reply.', path: ['phone'] })

/** Zod issues → { field: firstMessage } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] ??= issue.message
  }
  return out
}
