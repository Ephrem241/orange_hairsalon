import type { Metadata } from 'next'
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { ContactForm } from '@/components/site/ContactForm'
import { LocationMap } from '@/components/site/LocationMap'
import { PageHero } from '@/components/site/PageHero'
import { SocialLinks } from '@/components/site/SocialLinks'
import { ButtonAnchor, ButtonLink } from '@/components/ui/Button'
import { getBusinessHours, getSettings } from '@/lib/data/public'
import { formatPhone, mapQuery, mapsSearchHref, telHref, whatsappHref } from '@/lib/format'
import { groupHours } from '@/lib/hours'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Contact & Directions',
  description: 'Call, message or visit Orange Salon on Ednamoll Street, Addis Ababa. Opening hours, directions and contact details.',
  path: '/contact',
})

export default async function ContactPage() {
  const [settings, hours] = await Promise.all([getSettings(), getBusinessHours()])
  const address = [settings.addressLine, settings.city].filter(Boolean).join(', ')
  const directions = settings.mapUrl ?? mapsSearchHref(`${settings.name}, ${address}`)

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="We’d love to see you"
        description="Call or message us to book, ask about a style, or find your way to the salon."
        image={{ src: '/images/gallery/burgundy-waves-neon-sign.jpg', alt: '' }}
        imagePosition="center 20%"
      >
        <div className="flex flex-wrap gap-3">
          {settings.phone && (
            <ButtonAnchor href={telHref(settings.phone)}>
              <Phone aria-hidden className="size-4" /> Call {formatPhone(settings.phone)}
            </ButtonAnchor>
          )}
          <ButtonLink href="/book" variant="outline-light">
            Book online
          </ButtonLink>
        </div>
      </PageHero>

      <section className="bg-ivory py-20 md:py-28">
        <div className="container-x grid gap-16 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="display text-3xl md:text-4xl">Get in touch</h2>
            <ul className="mt-10 space-y-7">
              {settings.phone && (
                <ContactRow icon={Phone} label="Phone">
                  <a href={telHref(settings.phone)} className="text-lg text-charcoal hover:text-gold-700">{formatPhone(settings.phone)}</a>
                </ContactRow>
              )}
              {settings.whatsapp && (
                <ContactRow icon={MessageCircle} label="WhatsApp">
                  <a href={whatsappHref(settings.whatsapp, 'Hello Orange Salon, ')} target="_blank" rel="noopener noreferrer" className="text-lg text-charcoal hover:text-gold-700">
                    Message us on WhatsApp
                  </a>
                </ContactRow>
              )}
              {settings.email && (
                <ContactRow icon={Mail} label="Email">
                  <a href={`mailto:${settings.email}`} className="text-lg text-charcoal hover:text-gold-700">{settings.email}</a>
                </ContactRow>
              )}
              <ContactRow icon={MapPin} label="Address">
                <address className="text-lg text-charcoal not-italic">{address}</address>
                <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-gold-700 underline underline-offset-4">
                  Get directions
                </a>
              </ContactRow>
              <ContactRow icon={Clock} label="Opening hours">
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-charcoal">
                  {groupHours(hours).map((row) => (
                    <div key={row.days} className="contents">
                      <dt>{row.days}</dt>
                      <dd>{row.hours}</dd>
                    </div>
                  ))}
                </dl>
              </ContactRow>
            </ul>
            {Object.keys(settings.socials).length > 0 && (
              <div className="mt-10 inline-flex rounded-sm bg-charcoal px-5 py-4">
                <SocialLinks socials={settings.socials} />
              </div>
            )}
          </div>

          <div className="rounded-sm border border-charcoal/10 bg-white p-6 sm:p-10">
            <h2 className="display text-3xl">Send us a message</h2>
            <p className="mt-2 mb-8 text-sm text-taupe-700">
              For appointments, booking online or calling is quickest. For anything else, write to us here.
            </p>
            <ContactForm />
          </div>
        </div>
      </section>

      <section className="bg-charcoal-800 py-16">
        <div className="container-x">
          <LocationMap query={mapQuery(settings, address)} label={`${settings.name}, ${address}`} className="aspect-[4/3] md:aspect-[21/8]" />
        </div>
      </section>
    </>
  )
}

function ContactRow({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-charcoal/15 text-gold-700">
        <Icon aria-hidden className="size-[1.125rem]" />
      </span>
      <div>
        <p className="text-xs tracking-wide text-taupe-700 uppercase">{label}</p>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  )
}
