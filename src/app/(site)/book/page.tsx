import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Info, Phone } from 'lucide-react'
import { heroFilm } from '@/config/media'
import { BookingWizard } from '@/components/booking/BookingWizard'
import { PageHero } from '@/components/site/PageHero'
import { ButtonAnchor, ButtonLink } from '@/components/ui/Button'
import { getServices, getSettings, getStylists } from '@/lib/data/public'
import { isConvexConfigured, isDemoContentEnabled } from '@/lib/env'
import { formatPhone, telHref } from '@/lib/format'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Book an Appointment',
  description: 'Book your appointment at Orange Salon, Addis Ababa online: choose your service, stylist and a time that suits you.',
  path: '/book',
})

export default async function BookPage() {
  const [settings, services, stylists] = await Promise.all([getSettings(), getServices(), getStylists()])
  const demoPreview = !isConvexConfigured && isDemoContentEnabled
  // Opens only once some stylist can take one of the listed services online.
  const bookable = stylists.some((s) => s.acceptsOnlineBooking && services.some((service) => s.serviceIds.includes(service.id)))
  const open = (settings.onlineBookingEnabled || demoPreview) && bookable

  return (
    <>
      <PageHero
        compact
        eyebrow="Book your appointment"
        title="Reserve your chair"
        description="Choose a service, a stylist and a time. No account needed — you’ll get a booking reference straight away."
        video={heroFilm}
      />
      <section className="bg-ivory py-14 md:py-20">
        <div className="container-x">
          {demoPreview && (
            <p className="mb-10 flex items-start gap-3 rounded-sm border border-dashed border-gold-700/50 bg-white p-4 text-sm text-taupe-700">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700" />
              <span>
                <strong className="text-charcoal">Demo preview.</strong> The services and stylists below are sample data and no
                database is connected, so times cannot actually be booked. See docs/SETUP.md to connect Convex.
              </span>
            </p>
          )}
          {open ? (
            <Suspense fallback={<WizardSkeleton />}>
              <BookingWizard
                services={services}
                stylists={stylists}
                settings={{
                  requireEmail: settings.requireEmail,
                  maxAdvanceDays: settings.maxAdvanceDays,
                  minLeadMinutes: settings.minLeadMinutes,
                  policyText: settings.policyText,
                  cancelCutoffHours: settings.cancelCutoffHours,
                  autoConfirm: settings.autoConfirm,
                }}
              />
            </Suspense>
          ) : (
            <div className="mx-auto max-w-xl rounded-sm border border-charcoal/10 bg-white p-10 text-center">
              <h2 className="display text-3xl">Online booking opens soon</h2>
              <p className="mt-4 text-taupe-700">
                We’re getting our online diary ready.{settings.phone ? ' Until then, call us and we’ll find you a time.' : ''}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {settings.phone && (
                  <ButtonAnchor href={telHref(settings.phone)}>
                    <Phone aria-hidden className="size-4" /> {formatPhone(settings.phone)}
                  </ButtonAnchor>
                )}
                <ButtonLink href="/contact" variant="outline-dark">
                  Contact us
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

function WizardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading booking" className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div>
        <div className="h-8 w-80 max-w-full animate-pulse rounded-full bg-ivory-300" />
        <div className="mt-10 h-10 w-64 animate-pulse rounded-sm bg-ivory-300" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-30 animate-pulse rounded-sm bg-ivory-300" />
          ))}
        </div>
      </div>
      <div className="hidden h-72 animate-pulse rounded-sm bg-ivory-300 lg:block" />
    </div>
  )
}
