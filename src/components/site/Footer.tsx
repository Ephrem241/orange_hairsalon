import Link from 'next/link'
import { cacheLife } from 'next/cache'
import { Clock, MapPin, Phone } from 'lucide-react'
import { mainNav } from '@/config/site'
import { formatPhone, telHref } from '@/lib/format'
import { groupHours } from '@/lib/hours'
import type { BusinessHours, BusinessSettings, Service } from '@/lib/types'
import { SocialLinks } from './SocialLinks'
import { Wordmark } from './Wordmark'

async function CurrentYear() {
  'use cache'
  cacheLife('days')
  return <>{new Date().getFullYear()}</>
}

export function Footer({ settings, hours, services }: { settings: BusinessSettings; hours: BusinessHours[]; services: Service[] }) {
  const address = [settings.addressLine, settings.city].filter(Boolean).join(', ')
  return (
    <footer className="bg-charcoal-900 text-ivory">
      <div className="container-x grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.3fr] lg:gap-10">
        <div>
          <Link href="/" aria-label="Orange Salon — home" className="inline-block">
            <Wordmark />
          </Link>
          {settings.tagline && <p className="mt-5 max-w-xs text-sm text-ivory/60">{settings.tagline}</p>}
          <SocialLinks socials={settings.socials} className="mt-6" />
        </div>

        <nav aria-label="Footer">
          <h2 className="eyebrow text-gold">Quick links</h2>
          <ul className="mt-5 space-y-2.5 text-sm">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-ivory/70 transition-colors hover:text-gold">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/booking/manage" className="text-ivory/70 transition-colors hover:text-gold">
                Manage a booking
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="eyebrow text-gold">Our services</h2>
          {services.length > 0 ? (
            <ul className="mt-5 space-y-2.5 text-sm">
              {services.slice(0, 6).map((service) => (
                <li key={service.id}>
                  <Link href={`/services/${service.slug}`} className="text-ivory/70 transition-colors hover:text-gold">
                    {service.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-ivory/60">
              Braids, colour, cuts and styling.{' '}
              <Link href="/contact" className="text-gold underline-offset-4 hover:underline">
                Ask us about our menu
              </Link>
              .
            </p>
          )}
        </div>

        <div>
          <h2 className="eyebrow text-gold">Visit us</h2>
          <ul className="mt-5 space-y-4 text-sm text-ivory/70">
            {address && (
              <li className="flex gap-3">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-gold" />
                <address className="not-italic">{address}</address>
              </li>
            )}
            {settings.phone && (
              <li className="flex gap-3">
                <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-gold" />
                <a href={telHref(settings.phone)} className="transition-colors hover:text-gold">
                  {formatPhone(settings.phone)}
                </a>
              </li>
            )}
            <li className="flex gap-3">
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-gold" />
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {groupHours(hours).map((row) => (
                  <div key={row.days} className="contents">
                    <dt>{row.days}</dt>
                    <dd>{row.hours}</dd>
                  </div>
                ))}
              </dl>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ivory/10">
        <div className="container-x flex flex-col gap-4 py-6 text-xs text-ivory/50 md:flex-row md:items-center md:justify-between">
          <p>
            © <CurrentYear /> {settings.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li><Link href="/privacy" className="hover:text-gold">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-gold">Booking terms</Link></li>
            {/* Not prefetched: signed out, the prefetch would cache the redirect to the login page. */}
            <li><Link href="/admin" prefetch={false} className="hover:text-gold">Staff</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
