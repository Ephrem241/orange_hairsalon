/**
 * The Convex backend raises stable UPPER_SNAKE codes (ConvexError data.code, see convex/lib/errors.ts).
 * This maps them to HTTP statuses and copy a customer or staff member can act on.
 */
type ErrorInfo = { status: number; message: string }

const ERRORS: Record<string, ErrorInfo> = {
  SLOT_TAKEN: { status: 409, message: 'Sorry — that time was just booked by someone else. Please choose another time.' },
  SLOT_UNAVAILABLE: { status: 409, message: 'That time is no longer available. Please choose another.' },
  SLOT_NO_LONGER_AVAILABLE: {
    status: 409,
    message: 'This slot is no longer free (the schedule changed or the stylist is away). Reschedule it before confirming.',
  },
  STYLIST_UNAVAILABLE: { status: 409, message: 'That stylist isn’t available for this service. Try “Any available stylist”.' },
  SERVICE_UNAVAILABLE: { status: 409, message: 'This service is not currently bookable online.' },
  BOOKING_DISABLED: { status: 503, message: 'Online booking is paused right now. Please call us to book.' },
  NOT_CONFIGURED: { status: 503, message: 'Online booking is not available yet. Please call us to book.' },
  TOO_SOON: { status: 422, message: 'That time is too soon to book online. Please choose a later time or call us.' },
  TOO_FAR: { status: 422, message: 'That date is too far ahead to book online. Please choose an earlier date.' },
  POLICY_NOT_ACCEPTED: { status: 422, message: 'Please accept the booking policy to continue.' },
  EMAIL_REQUIRED: { status: 422, message: 'Please add your email address.' },
  INVALID_NAME: { status: 422, message: 'Please enter your full name.' },
  INVALID_PHONE: { status: 422, message: 'Please enter a valid phone number.' },
  INVALID_EMAIL: { status: 422, message: 'Please enter a valid email address.' },
  NOTES_TOO_LONG: { status: 422, message: 'Notes can be up to 1000 characters.' },
  INVALID_TIME: { status: 422, message: 'Please choose a time.' },
  IN_PAST: { status: 422, message: 'That time has already passed.' },
  NOT_FOUND: { status: 404, message: 'We couldn’t find that booking.' },
  PAST_CUTOFF: {
    status: 409,
    message: 'It’s too close to your appointment to change it online. Please call the salon.',
  },
  CHANGES_NOT_ALLOWED: { status: 409, message: 'Online changes aren’t available. Please call the salon.' },
  INVALID_TRANSITION: { status: 409, message: 'This appointment can’t be changed in that way.' },
  REASON_REQUIRED: { status: 422, message: 'Please give a reason.' },
  NOT_STARTED: { status: 409, message: 'An appointment can only be completed or marked no-show once it has started.' },
  INVALID_AMOUNT: { status: 422, message: 'Please enter a valid amount in ETB.' },
  FORBIDDEN: { status: 403, message: 'You don’t have permission to do that.' },
  LAST_ADMIN: { status: 409, message: 'The salon needs at least one active admin. Promote someone else first.' },
  SCHEDULE_OVERLAP: { status: 422, message: 'Working periods on the same day can’t overlap.' },
  INVALID_SCHEDULE: { status: 422, message: 'Each period must end after it starts.' },
  STYLIST_LINK_REQUIRED: { status: 422, message: 'Stylist logins must be linked to a stylist profile.' },
  RATE_LIMITED: { status: 429, message: 'Too many attempts. Please wait a few minutes and try again.' },
  INVALID_INPUT: { status: 422, message: 'Please check the details and try again.' },
  SLUG_TAKEN: { status: 409, message: 'Another item already uses this web address (slug).' },
  HAS_BOOKINGS: { status: 409, message: 'This service has bookings, so it can’t be deleted. Switch it off (inactive) instead.' },
  POSTER_REQUIRED: { status: 422, message: 'Videos need a poster image.' },
  INVALID_UPLOAD: { status: 422, message: 'Use a JPEG, PNG, WebP or AVIF image up to 8 MB, or an MP4 or WebM video up to 50 MB.' },
  WEAK_PASSWORD: { status: 422, message: 'Use between 12 and 128 characters.' },
  ACCOUNT_EXISTS: { status: 409, message: 'An account with this email already exists.' },
  STYLIST_ALREADY_LINKED: { status: 409, message: 'That stylist profile already has its own login.' },
}

export type AppError = { code: string; status: number; message: string }

/** The error code carried by a thrown ConvexError (or anything else thrown). */
export function errorCode(error: unknown): string {
  const data = (error as { data?: unknown } | null)?.data
  if (data && typeof data === 'object' && typeof (data as { code?: unknown }).code === 'string') return (data as { code: string }).code
  // Argument validation (e.g. a malformed id) means the request itself was wrong.
  if (/ArgumentValidationError/.test((error as Error | null)?.message ?? '')) return 'INVALID_INPUT'
  return 'UNKNOWN'
}

/** Map anything thrown by a Convex call to an HTTP status and friendly copy. */
export function toAppError(error: unknown): AppError {
  const code = errorCode(error)
  const info = ERRORS[code]
  if (!info) {
    console.error('[convex] unexpected error', error)
    return { code: 'UNKNOWN', status: 500, message: 'Something went wrong on our side. Please try again, or call the salon.' }
  }
  return { code, ...info }
}

export function appError(code: keyof typeof ERRORS): AppError {
  return { code, ...ERRORS[code] }
}

export const isKnownError = (code: string) => code in ERRORS
