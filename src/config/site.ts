/**
 * Verified fallback details for Orange Salon.
 *
 * The `business_settings` row in the database is the source of truth; these
 * values are used only when the database is not configured or unreachable, so
 * the public site always shows correct contact information. Only details the
 * salon has confirmed belong here.
 */
export const SALON_TIME_ZONE = 'Africa/Addis_Ababa'
export const CURRENCY = 'ETB'

export const verifiedBusiness = {
  name: 'Orange Salon',
  tagline: 'Your Hair. Your Style. Your Confidence.',
  phone: '+251912419748',
  addressLine: 'Ednamoll Street',
  city: 'Addis Ababa',
  countryCode: 'ET',
} as const

/** 0 = Sunday … 6 = Saturday, salon-local wall-clock times. */
export const verifiedHours: { weekday: number; opensAt: string; closesAt: string; isClosed: boolean }[] = [
  { weekday: 0, opensAt: '09:00', closesAt: '19:30', isClosed: false },
  { weekday: 1, opensAt: '08:00', closesAt: '20:00', isClosed: false },
  { weekday: 2, opensAt: '08:00', closesAt: '20:00', isClosed: false },
  { weekday: 3, opensAt: '08:00', closesAt: '20:00', isClosed: false },
  { weekday: 4, opensAt: '08:00', closesAt: '20:00', isClosed: false },
  { weekday: 5, opensAt: '08:00', closesAt: '20:00', isClosed: false },
  { weekday: 6, opensAt: '08:00', closesAt: '20:00', isClosed: false },
]

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export const mainNav = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/about', label: 'About' },
  { href: '/about#team', label: 'Our Team' },
  { href: '/contact', label: 'Contact' },
] as const
