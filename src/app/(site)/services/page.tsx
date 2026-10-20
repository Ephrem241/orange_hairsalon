import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Phone } from 'lucide-react'
import { heroFilm } from '@/config/media'
import { PageHero } from '@/components/site/PageHero'
import { ServiceCard } from '@/components/site/ServiceCard'
import { ServicesExplorer } from '@/components/site/ServicesExplorer'
import { ButtonAnchor, ButtonLink } from '@/components/ui/Button'
import { getCategories, getServices, getSettings } from '@/lib/data/public'
import { formatPhone, telHref } from '@/lib/format'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Services & Prices',
  description:
    'Hair services at Orange Salon, Addis Ababa — braids and protective styles, colour, cuts, styling and treatments, with prices in ETB and appointment times.',
  path: '/services',
})

export default async function ServicesPage() {
  const [services, categories, settings] = await Promise.all([getServices(), getCategories(), getSettings()])

  return (
    <>
      <PageHero
        eyebrow="Our services"
        title="Look good. Feel amazing."
        description="Every service begins with a consultation, so the result suits your hair, your face and your routine. Prices are in Ethiopian birr and paid at the salon."
        video={heroFilm}
      />

      <section className="bg-ivory py-20 md:py-24">
        <div className="container-x">
          {services.length > 0 ? (
            <Suspense
              fallback={
                <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map((service) => (
                    <li key={service.id}>
                      <ServiceCard service={service} />
                    </li>
                  ))}
                </ul>
              }
            >
              <ServicesExplorer services={services} categories={categories} />
            </Suspense>
          ) : (
            <div className="mx-auto max-w-xl rounded-sm border border-charcoal/10 bg-white p-10 text-center">
              <h2 className="display text-3xl">Our menu is coming soon</h2>
              <p className="mt-4 text-taupe-700">
                We’re preparing our full list of services and prices for online booking.
                {settings.phone ? ' In the meantime, give us a call and we’ll gladly help.' : ''}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {settings.phone && (
                  <ButtonAnchor href={telHref(settings.phone)}>
                    <Phone aria-hidden className="size-4" /> {formatPhone(settings.phone)}
                  </ButtonAnchor>
                )}
                <ButtonLink href="/gallery" variant="outline-dark">
                  See our work
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
