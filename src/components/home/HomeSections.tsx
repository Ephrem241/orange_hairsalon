import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock, Heart, MapPin, Phone, Scissors, Sparkles, UserRound } from 'lucide-react'
import { aboutPhoto, neonSignPhoto } from '@/config/media'
import { BeforeAfter } from '@/components/site/BeforeAfter'
import { LocationMap } from '@/components/site/LocationMap'
import { Reveal } from '@/components/site/Reveal'
import { ReviewCard } from '@/components/site/ReviewCard'
import { SectionHeading } from '@/components/site/SectionHeading'
import { ServiceCard } from '@/components/site/ServiceCard'
import { StylistCard } from '@/components/site/StylistCard'
import { ButtonAnchor, ButtonLink } from '@/components/ui/Button'
import { formatPhone, mapQuery, mapsSearchHref, telHref } from '@/lib/format'
import { groupHours } from '@/lib/hours'
import type { BusinessHours, BusinessSettings, GalleryItem, Review, Service, Stylist } from '@/lib/types'

export function Introduction({ city }: { city: string }) {
  return (
    <section id="introduction" className="bg-ivory py-24 md:py-32">
      <div className="container-x grid gap-12 md:grid-cols-[1.2fr_1fr] md:items-end md:gap-20">
        <Reveal>
          <p className="eyebrow text-gold-700">Welcome to Orange Salon</p>
          <h2 className="display mt-6 text-4xl text-charcoal md:text-[3.4rem] md:leading-[1.08]">
            Hair care with intention, <span className="italic text-gold-700">crafted</span> in the heart of {city}.
          </h2>
        </Reveal>
        <Reveal delay={150}>
          <p className="text-[1.0625rem] leading-relaxed text-taupe-700">
            From protective braids and twists to rich colour and soft, defined curls, every appointment starts with
            listening. We take the time to understand your hair, your routine and the look you want — then we bring
            it to life with care.
          </p>
          <Link
            href="/about"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium tracking-wide text-charcoal underline-offset-8 hover:text-gold-700 hover:underline"
          >
            Discover our approach <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

/** Featured services from the dashboard; falls back to a portfolio of real work when no menu is published yet. */
export function SignatureServices({ services, gallery, phone }: { services: Service[]; gallery: GalleryItem[]; phone: string | null }) {
  const featured = [...services].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)).slice(0, 6)

  if (featured.length > 0) {
    return (
      <section aria-labelledby="services-title" className="bg-ivory-200 py-24 md:py-28">
        <div className="container-x">
          <Reveal>
            <SectionHeading
              eyebrow="Our services"
              title={<span id="services-title">Look good. Feel amazing.</span>}
              action={
                <Link href="/services" className="inline-flex items-center gap-2 text-sm font-medium text-charcoal hover:text-gold-700">
                  View all services <ArrowRight aria-hidden className="size-4" />
                </Link>
              }
            />
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((service, i) => (
              <Reveal key={service.id} delay={(i % 3) * 120}>
                <ServiceCard service={service} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    )
  }

  // No published menu yet: show the crafts the salon's own portfolio demonstrates.
  const crafts = [
    { category: 'braids', title: 'Braids & protective styles' },
    { category: 'colour', title: 'Colour & highlights' },
    { category: 'styling', title: 'Curls & styling' },
  ]
    .map((craft) => ({ ...craft, image: gallery.find((g) => g.category === craft.category && g.mediaType === 'image') }))
    .filter((craft) => craft.image)

  if (crafts.length === 0) return null
  return (
    <section aria-labelledby="crafts-title" className="bg-ivory-200 py-24 md:py-28">
      <div className="container-x">
        <Reveal>
          <SectionHeading
            eyebrow="What we do"
            title={<span id="crafts-title">Look good. Feel amazing.</span>}
            description={
              <>
                Our full menu and online prices are coming soon.
                {phone && (
                  <>
                    {' '}
                    Call{' '}
                    <a href={telHref(phone)} className="text-charcoal underline underline-offset-4">
                      {formatPhone(phone)}
                    </a>{' '}
                    for prices and availability.
                  </>
                )}
              </>
            }
          />
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {crafts.map((craft, i) => (
            <Reveal key={craft.category} delay={i * 120}>
              <Link href={`/gallery?category=${craft.category}`} className="group relative block aspect-[3/4] overflow-hidden rounded-sm">
                <Image
                  src={craft.image!.mediaPath}
                  alt={craft.image!.altText}
                  fill
                  sizes="(min-width: 768px) 30vw, 90vw"
                  className="object-cover transition-transform duration-[1400ms] ease-[var(--ease-cinematic)] group-hover:scale-105"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-charcoal/85 via-charcoal/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-ivory">
                  <h3 className="font-serif text-2xl">{craft.title}</h3>
                  <span className="mt-2 inline-flex items-center gap-2 text-xs tracking-wide text-ivory/75 group-hover:text-gold">
                    See our work <ArrowRight aria-hidden className="size-3.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Transformations({ gallery }: { gallery: GalleryItem[] }) {
  const photos = gallery.filter((g) => g.mediaType === 'image')
  const featured = [...photos.filter((g) => g.isFeatured), ...photos.filter((g) => !g.isFeatured)].slice(0, 5)
  if (featured.length === 0) return null
  const [lead, ...rest] = featured

  return (
    <section aria-labelledby="work-title" className="bg-charcoal py-24 text-ivory md:py-32">
      <div className="container-x grid gap-12 lg:grid-cols-[0.8fr_2fr] lg:gap-16">
        <Reveal className="lg:pt-10">
          <p className="eyebrow text-gold">Our work</p>
          <h2 id="work-title" className="display mt-5 text-4xl md:text-5xl">
            Signature transformations
          </h2>
          <p className="mt-6 max-w-sm text-ivory/70">
            Real clients, real results — photographed in our salon. Explore our latest styles and colour work.
          </p>
          <ButtonLink href="/gallery" variant="outline-light" arrow className="mt-10">
            View full gallery
          </ButtonLink>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:grid-rows-2 md:gap-4">
          <Reveal className="col-span-2 row-span-2">
            <GalleryTile item={lead} sizes="(min-width: 1024px) 34vw, 90vw" className="aspect-[4/5] md:aspect-auto md:h-full" />
          </Reveal>
          {rest.map((item, i) => (
            <Reveal key={item.id} delay={100 + i * 100}>
              <GalleryTile item={item} sizes="(min-width: 1024px) 16vw, 45vw" className="aspect-[4/5]" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function GalleryTile({ item, sizes, className }: { item: GalleryItem; sizes: string; className?: string }) {
  return (
    <figure className={`group relative h-full overflow-hidden rounded-sm bg-charcoal-700 ${className ?? ''}`}>
      <Image
        src={item.mediaPath}
        alt={item.altText}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-[1600ms] ease-[var(--ease-cinematic)] group-hover:scale-[1.06]"
      />
      {item.caption && (
        <figcaption className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-charcoal/90 to-transparent p-4 pt-10 text-xs tracking-wide text-ivory opacity-0 transition-all duration-700 group-hover:translate-y-0 group-hover:opacity-100">
          {item.caption}
        </figcaption>
      )}
    </figure>
  )
}

/** Only rendered when the salon has uploaded a genuine before/after pair. */
export function BeforeAfterSection({ gallery }: { gallery: GalleryItem[] }) {
  const pair = gallery.find((g) => g.beforePath && g.mediaType === 'image')
  if (!pair?.beforePath) return null
  return (
    <section aria-labelledby="ba-title" className="bg-ivory py-24 md:py-28">
      <div className="container-x grid gap-12 md:grid-cols-2 md:items-center md:gap-20">
        <Reveal>
          <p className="eyebrow text-gold-700">Before &amp; after</p>
          <h2 id="ba-title" className="display mt-5 text-4xl text-charcoal md:text-5xl">
            The difference is in the detail
          </h2>
          {pair.caption && <p className="mt-6 max-w-md text-taupe-700">{pair.caption}</p>}
        </Reveal>
        <Reveal delay={150}>
          <BeforeAfter before={pair.beforePath} after={pair.mediaPath} alt={pair.altText} />
        </Reveal>
      </div>
    </section>
  )
}

const VALUES = [
  { icon: Scissors, title: 'Considered consultation', text: 'Every visit starts with understanding your hair and your goals.' },
  { icon: Sparkles, title: 'Care for healthy hair', text: 'Techniques chosen to protect your hair, not just style it.' },
  { icon: UserRound, title: 'Personal to you', text: 'Styles tailored to your face, lifestyle and routine.' },
  { icon: Heart, title: 'A welcoming space', text: 'Relax, refresh and feel at home while we work.' },
]

export function AboutTeaser() {
  return (
    <section aria-labelledby="about-title" className="bg-ivory py-24 md:py-32">
      <div className="container-x grid gap-14 lg:grid-cols-[1fr_1.1fr_0.9fr] lg:items-center lg:gap-14">
        <Reveal className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
            <Image src={aboutPhoto.src} alt={aboutPhoto.alt} fill sizes="(min-width: 1024px) 30vw, 90vw" className="object-cover" />
          </div>
          <div className="absolute -right-4 -bottom-8 hidden w-36 overflow-hidden rounded-sm border-4 border-ivory shadow-xl md:block lg:-right-6">
            <div className="relative aspect-[3/5]">
              <Image src={neonSignPhoto.src} alt={neonSignPhoto.alt} fill sizes="144px" className="object-cover" />
            </div>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <p className="eyebrow text-gold-700">About Orange Salon</p>
          <h2 id="about-title" className="display mt-5 text-4xl text-charcoal md:text-5xl">
            More than a salon. It’s an experience.
          </h2>
          <p className="mt-6 leading-relaxed text-taupe-700">
            At Orange Salon we believe great hair builds confidence. Our team brings personal care, professional
            craft and a warm atmosphere to every appointment on Ednamoll Street.
          </p>
          <ButtonLink href="/about" arrow className="mt-9">
            Our story
          </ButtonLink>
        </Reveal>
        <ul className="grid gap-7 border-charcoal/10 sm:grid-cols-2 lg:grid-cols-1 lg:border-l lg:pl-10">
          {VALUES.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Reveal delay={200 + i * 100} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-charcoal/15 text-gold-700">
                  <Icon aria-hidden className="size-[1.125rem]" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-charcoal">{title}</h3>
                  <p className="mt-1 text-sm text-taupe-700">{text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function TeamSection({ stylists }: { stylists: Stylist[] }) {
  if (stylists.length === 0) return null
  return (
    <section aria-labelledby="team-title" className="bg-charcoal py-24 text-ivory md:py-28">
      <div className="container-x grid gap-12 lg:grid-cols-[0.8fr_2fr]">
        <Reveal>
          <p className="eyebrow text-gold">Our team</p>
          <h2 id="team-title" className="display mt-5 text-4xl md:text-5xl">
            Meet our stylists
          </h2>
          <p className="mt-5 max-w-xs text-ivory/70">Talented, creative and dedicated to your look.</p>
          <ButtonLink href="/about#team" variant="outline-light" arrow className="mt-9">
            View our team
          </ButtonLink>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stylists.slice(0, 4).map((stylist, i) => (
            <Reveal key={stylist.id} delay={i * 100}>
              <StylistCard stylist={stylist} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ReviewsSection({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null
  return (
    <section aria-labelledby="reviews-title" className="bg-ivory-200 py-24 md:py-28">
      <div className="container-x">
        <Reveal>
          <SectionHeading eyebrow="Testimonials" title={<span id="reviews-title">What our clients say</span>} />
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {reviews.slice(0, 3).map((review, i) => (
            <Reveal key={review.id} delay={i * 120}>
              <ReviewCard review={review} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function VisitSection({ settings, hours }: { settings: BusinessSettings; hours: BusinessHours[] }) {
  const address = [settings.addressLine, settings.city].filter(Boolean).join(', ')
  const directions = settings.mapUrl ?? mapsSearchHref(`${settings.name}, ${address}`)
  return (
    <section aria-labelledby="visit-title" className="bg-charcoal-800 py-24 text-ivory md:py-28">
      <div className="container-x grid gap-12 md:grid-cols-2 md:items-center md:gap-20">
        <Reveal>
          <p className="eyebrow text-gold">Visit us</p>
          <h2 id="visit-title" className="display mt-5 text-4xl md:text-5xl">
            Find us on Ednamoll Street
          </h2>
          <dl className="mt-10 space-y-6 text-[0.95rem]">
            <div className="flex gap-4">
              <dt><MapPin aria-label="Address" className="mt-0.5 size-5 text-gold" /></dt>
              <dd><address className="not-italic text-ivory/85">{address}</address></dd>
            </div>
            {settings.phone && (
              <div className="flex gap-4">
                <dt><Phone aria-label="Phone" className="mt-0.5 size-5 text-gold" /></dt>
                <dd><a href={telHref(settings.phone)} className="text-ivory/85 hover:text-gold">{formatPhone(settings.phone)}</a></dd>
              </div>
            )}
            <div className="flex gap-4">
              <dt><Clock aria-label="Opening hours" className="mt-0.5 size-5 text-gold" /></dt>
              <dd className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-ivory/85">
                {groupHours(hours).map((row) => (
                  <span key={row.days} className="contents">
                    <span>{row.days}</span>
                    <span>{row.hours}</span>
                  </span>
                ))}
              </dd>
            </div>
          </dl>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonAnchor href={directions} target="_blank" rel="noopener noreferrer" arrow>
              Get directions
            </ButtonAnchor>
            {settings.phone && (
              <ButtonAnchor href={telHref(settings.phone)} variant="outline-light">
                Call the salon
              </ButtonAnchor>
            )}
          </div>
        </Reveal>
        <Reveal delay={150}>
          <LocationMap query={mapQuery(settings, address)} label={`${settings.name}, ${address}`} />
        </Reveal>
      </div>
    </section>
  )
}
