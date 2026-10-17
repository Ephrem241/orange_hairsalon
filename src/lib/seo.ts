import type { Metadata } from 'next'
import { siteUrl } from '@/config/site'
import type { BusinessHours, BusinessSettings } from '@/lib/types'

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Per-page metadata with canonical URL and Open Graph defaults. */
export function pageMetadata({
  title,
  description,
  path,
  image = '/images/hero/hero-poster.jpg',
  noIndex = false,
}: {
  title?: string
  description: string
  path: string
  image?: string
  noIndex?: boolean
}): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      title: title ? `${title} · Orange Salon` : 'Orange Salon — Hair Salon in Addis Ababa',
      description,
      url: path,
      images: [{ url: image, width: 1600, height: 900, alt: 'Orange Salon, Addis Ababa' }],
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  }
}

/**
 * schema.org HairSalon built only from verified settings: no price range,
 * ratings or coordinates are emitted unless the salon has entered them.
 */
export function salonJsonLd(settings: BusinessSettings, hours: BusinessHours[]) {
  const open = hours.filter((h) => !h.isClosed && h.opensAt && h.closesAt)
  const groups = new Map<string, string[]>()
  for (const h of open) {
    const key = `${h.opensAt}-${h.closesAt}`
    groups.set(key, [...(groups.get(key) ?? []), DAY[h.weekday]])
  }
  const sameAs = Object.values(settings.socials).filter(Boolean)

  return {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    '@id': `${siteUrl}/#salon`,
    name: settings.name,
    url: siteUrl,
    image: `${siteUrl}/images/hero/hero-poster.jpg`,
    logo: `${siteUrl}/images/brand/orange-salon-logo.jpg`,
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.email ? { email: settings.email } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(settings.addressLine ? { streetAddress: settings.addressLine } : {}),
      addressLocality: settings.city,
      addressCountry: settings.countryCode,
    },
    ...(settings.latitude !== null && settings.longitude !== null
      ? { geo: { '@type': 'GeoCoordinates', latitude: settings.latitude, longitude: settings.longitude } }
      : {}),
    ...(settings.mapUrl ? { hasMap: settings.mapUrl } : {}),
    openingHoursSpecification: [...groups.entries()].map(([key, days]) => {
      const [opens, closes] = key.split('-')
      return { '@type': 'OpeningHoursSpecification', dayOfWeek: days, opens, closes }
    }),
    currenciesAccepted: 'ETB',
    ...(sameAs.length ? { sameAs } : {}),
  }
}

/** Serialise JSON-LD safely for a <script> tag (no `</script>` breakout). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
