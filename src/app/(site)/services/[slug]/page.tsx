import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ArrowLeft, Clock, Wallet } from 'lucide-react'
import { DemoBadge } from '@/components/site/DemoBadge'
import { ServiceCard } from '@/components/site/ServiceCard'
import { ButtonLink } from '@/components/ui/Button'
import { getServiceBySlug, getServices, getStylists } from '@/lib/data/public'
import { formatDuration, formatEtb } from '@/lib/format'
import { pageMetadata } from '@/lib/seo'

/** Placeholder so the route validates at build time before any services exist. */
const NO_SERVICES = '__no-services__'

export async function generateStaticParams() {
  const services = await getServices()
  return services.length ? services.map((s) => ({ slug: s.slug })) : [{ slug: NO_SERVICES }]
}

export async function generateMetadata({ params }: PageProps<'/services/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const service = await getServiceBySlug(slug)
  if (!service) return { title: 'Service not found', robots: { index: false } }
  return pageMetadata({
    title: service.name,
    description:
      service.summary ??
      `${service.name} at Orange Salon, Addis Ababa — ${formatEtb(service.priceEtb, service.priceType)}, about ${formatDuration(service.durationMin)}.`,
    path: `/services/${service.slug}`,
    image: service.imagePath ? service.imagePath : undefined,
  })
}

export default function ServicePage({ params }: PageProps<'/services/[slug]'>) {
  return (
    <Suspense fallback={<div className="min-h-[80vh] bg-charcoal" />}>
      <ServiceDetail params={params} />
    </Suspense>
  )
}

async function ServiceDetail({ params }: Pick<PageProps<'/services/[slug]'>, 'params'>) {
  const { slug } = await params
  const [service, services, stylists] = await Promise.all([getServiceBySlug(slug), getServices(), getStylists()])
  if (!service) notFound()

  const team = stylists.filter((s) => s.serviceIds.includes(service.id))
  const related = services.filter((s) => s.id !== service.id && s.category?.id === service.category?.id).slice(0, 3)

  return (
    <>
      <section className="bg-charcoal pt-28 text-ivory md:pt-32">
        <div className="container-x grid gap-12 pb-20 md:grid-cols-2 md:items-center md:gap-16 md:pb-28">
          <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-charcoal-700">
            {service.imagePath ? (
              <Image src={service.imagePath} alt="" fill preload sizes="(min-width: 768px) 45vw, 90vw" className="object-cover" />
            ) : (
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_#3b3630,_#171513)]" />
            )}
            {service.isDemo && <DemoBadge className="absolute left-4 top-4" />}
          </div>
          <div>
            <Link href="/services" className="inline-flex items-center gap-2 text-sm text-ivory/60 hover:text-gold">
              <ArrowLeft aria-hidden className="size-4" /> All services
            </Link>
            {service.category && <p className="eyebrow mt-8 text-gold">{service.category.name}</p>}
            <h1 className="display mt-4 text-5xl md:text-6xl">{service.name}</h1>
            {service.summary && <p className="mt-6 text-lg text-ivory/80">{service.summary}</p>}
            <dl className="mt-10 grid max-w-sm grid-cols-2 gap-6 border-y border-ivory/10 py-6">
              <div>
                <dt className="flex items-center gap-2 text-xs tracking-wide text-taupe uppercase">
                  <Wallet aria-hidden className="size-4" /> Price
                </dt>
                <dd className="mt-2 font-serif text-2xl">{formatEtb(service.priceEtb, service.priceType)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs tracking-wide text-taupe uppercase">
                  <Clock aria-hidden className="size-4" /> Duration
                </dt>
                <dd className="mt-2 font-serif text-2xl">{formatDuration(service.durationMin)}</dd>
              </div>
            </dl>
            {service.priceType === 'from' && (
              <p className="mt-4 text-sm text-ivory/60">Final price depends on hair length and thickness; confirmed at your consultation.</p>
            )}
            <ButtonLink href={`/book?service=${service.slug}`} size="lg" arrow className="mt-10">
              Book this service
            </ButtonLink>
          </div>
        </div>
      </section>

      {(service.description || team.length > 0) && (
        <section className="bg-ivory py-20">
          <div className="container-x grid gap-12 md:grid-cols-[1.4fr_1fr]">
            {service.description && (
              <div>
                <h2 className="display text-3xl">About this service</h2>
                <div className="mt-6 space-y-4 leading-relaxed whitespace-pre-line text-taupe-700">{service.description}</div>
              </div>
            )}
            {team.length > 0 && (
              <div>
                <h2 className="eyebrow text-gold-700">Who can do it</h2>
                <ul className="mt-5 space-y-3">
                  {team.map((stylist) => (
                    <li key={stylist.id} className="flex items-center justify-between border-b border-charcoal/10 pb-3">
                      <span className="font-serif text-lg">{stylist.displayName}</span>
                      {stylist.title && <span className="text-sm text-taupe-700">{stylist.title}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="bg-ivory-200 py-20">
          <div className="container-x">
            <h2 className="display text-3xl">You may also like</h2>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((s) => (
                <li key={s.id}>
                  <ServiceCard service={s} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}
