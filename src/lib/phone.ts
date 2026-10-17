/**
 * Phone normalisation. Bookings are keyed on the customer's phone in E.164
 * form, so the same number typed differently ("0912 41 97 48",
 * "+251-912-419748") must always normalise to one value.
 *
 * Ethiopian mobiles: 9XXXXXXXX (Ethio Telecom) and 7XXXXXXXX (Safaricom),
 * written locally with a leading 0. Other countries are accepted in full
 * international form (diaspora clients).
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  // Local Ethiopian formats: 09…, 07… (10 digits) or 9…, 7… (9 digits).
  if (!hasPlus) {
    if (/^0[79]\d{8}$/.test(digits)) return `+251${digits.slice(1)}`
    if (/^[79]\d{8}$/.test(digits)) return `+251${digits}`
    if (/^251[79]\d{8}$/.test(digits)) return `+${digits}`
    if (/^00[1-9]\d{7,14}$/.test(digits)) return validE164(`+${digits.slice(2)}`)
    return null
  }

  return validE164(`+${digits}`)
}

function validE164(candidate: string): string | null {
  if (!/^\+[1-9]\d{7,14}$/.test(candidate)) return null
  // Ethiopian numbers must be complete mobile or landline numbers (9 digits after 251).
  if (candidate.startsWith('+251') && !/^\+251\d{9}$/.test(candidate)) return null
  return candidate
}
