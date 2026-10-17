/** Display formatting for prices, durations and contact details. */

const etb = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** "ETB 1,500" — or "From ETB 1,500" for variable pricing. Whole birr only. */
export function formatEtb(amount: number, priceType: 'fixed' | 'from' = 'fixed'): string {
  const value = `ETB ${etb.format(Math.round(amount))}`
  return priceType === 'from' ? `From ${value}` : value
}

/** 45 → "45 min", 90 → "1 hr 30 min", 120 → "2 hr" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

/** "+251912419748" → "+251 91 241 9748" (other countries: grouped digits). */
export function formatPhone(e164: string): string {
  const match = /^\+251(\d{2})(\d{3})(\d{4})$/.exec(e164)
  if (match) return `+251 ${match[1]} ${match[2]} ${match[3]}`
  return e164.replace(/^(\+\d{1,3})(\d+)$/, (_all, cc: string, rest: string) => `${cc} ${rest.replace(/(\d{3})(?=\d)/g, '$1 ')}`)
}

export const telHref = (e164: string) => `tel:${e164}`

export function whatsappHref(e164: string, message?: string): string {
  const base = `https://wa.me/${e164.replace(/^\+/, '')}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

export function mapsSearchHref(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}
