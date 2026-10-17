import type { Metadata } from 'next'
import Image from 'next/image'
import { aboutPhoto, neonSignPhoto } from '@/config/media'
import { CtaBand } from '@/components/site/CtaBand'
import { PageHero } from '@/components/site/PageHero'
import { Reveal } from '@/components/site/Reveal'
import { StylistCard } from '@/components/site/StylistCard'
import { getSettings, getStylists } from '@/lib/data/public'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'About',
  description:
    'Orange Salon is a hair salon on Ednamoll Street in Addis Ababa. Meet our team and discover our approach to braids, colour and styling.',
  path: '/about',
  image: aboutPhoto.src,
})

const PRINCIPLES = [
  {
    title: 'We listen first',
    text: 'Every appointment begins with a conversation about your hair, your routine and the look you want — so the result is yours, not ours.',
  },
  {
    title: 'Healthy hair, always',
    text: 'Whether it is protective braiding or colour, we choose techniques that respect your hair and keep it strong.',
  },
  {
    title: 'Craft in the details',
    text: 'Clean parts, even tension, considered colour placement. The small things are what make a style last and look effortless.',
  },
]

export default async function AboutPage() {
  const [settings, stylists] = await Promise.all([getSettings(), getStylists()])

  return (
    <>
      <PageHero
        eyebrow="About Orange Salon"
        title="More than a salon. It’s an experience."
        description={`A warm, modern space on ${settings.addressLine ?? 'Ednamoll Street'} in ${settings.city}, where great hair builds confidence.`}
        image={{ src: aboutPhoto.src, alt: '' }}
        imagePosition="center 25%"
      />

      {settings.aboutStory && (
        <section className="bg-ivory py-24">
          <div className="container-x max-w-3xl">
            <Reveal>
              <p className="eyebrow text-gold-700">Our story</p>
              <div className="mt-6 space-y-5 font-serif text-2xl leading-relaxed whitespace-pre-line text-charcoal">
                {settings.aboutStory}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <section className="bg-ivory py-24 md:py-32">
        <div className="container-x grid gap-16 lg:grid-cols-2 lg:items-center">
          <Reveal className="grid grid-cols-5 gap-4">
            <div className="relative col-span-3 aspect-[3/4] overflow-hidden rounded-sm">
              <Image src={aboutPhoto.src} alt={aboutPhoto.alt} fill sizes="(min-width: 1024px) 28vw, 55vw" className="object-cover" />
            </div>
            <div className="relative col-span-2 mt-16 aspect-[3/5] overflow-hidden rounded-sm">
              <Image src={neonSignPhoto.src} alt={neonSignPhoto.alt} fill sizes="(min-width: 1024px) 18vw, 38vw" className="object-cover" />
            </div>
          </Reveal>
          <div>
            <Reveal>
              <p className="eyebrow text-gold-700">Our approach</p>
              <h2 className="display mt-5 text-4xl md:text-5xl">Personal care, professional craft</h2>
            </Reveal>
            <ol className="mt-12 space-y-10">
              {PRINCIPLES.map((p, i) => (
                <li key={p.title}>
                  <Reveal delay={i * 120} className="grid grid-cols-[3rem_1fr] gap-4">
                    <span className="font-serif text-3xl text-gold-700 tabular-nums">0{i + 1}</span>
                    <div>
                      <h3 className="font-serif text-xl">{p.title}</h3>
                      <p className="mt-2 leading-relaxed text-taupe-700">{p.text}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="team" aria-labelledby="team-heading" className="scroll-mt-20 bg-charcoal py-24 text-ivory md:py-28">
        <div className="container-x">
          <Reveal>
            <p className="eyebrow text-gold">Our team</p>
            <h2 id="team-heading" className="display mt-5 text-4xl md:text-5xl">
              Meet our stylists
            </h2>
          </Reveal>
          {stylists.length > 0 ? (
            <ul className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {stylists.map((stylist, i) => (
                <li key={stylist.id}>
                  <Reveal delay={(i % 4) * 100}>
                    <StylistCard stylist={stylist} />
                    {stylist.bio && <p className="mt-3 text-sm leading-relaxed text-ivory/65">{stylist.bio}</p>}
                  </Reveal>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 max-w-lg text-ivory/70">
              Our stylist profiles are on their way. Visit us on {settings.addressLine ?? 'Ednamoll Street'} to meet the team in person.
            </p>
          )}
        </div>
      </section>

      <CtaBand />
    </>
  )
}
