import type { Metadata } from 'next'
import { CinematicHero } from '@/components/site/CinematicHero'
import { CtaBand } from '@/components/site/CtaBand'
import {
  AboutTeaser,
  BeforeAfterSection,
  Introduction,
  ReviewsSection,
  SignatureServices,
  TeamSection,
  Transformations,
  VisitSection,
} from '@/components/home/HomeSections'
import { getBusinessHours, getGallery, getReviews, getServices, getSettings, getStylists } from '@/lib/data/public'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  description:
    'Orange Salon on Ednamoll Street, Addis Ababa — braids and protective styles, colour, cuts and styling in a warm, modern salon. Book your appointment online.',
  path: '/',
})

export default async function HomePage() {
  const [settings, hours, services, gallery, stylists, reviews] = await Promise.all([
    getSettings(),
    getBusinessHours(),
    getServices(),
    getGallery(),
    getStylists(),
    getReviews(),
  ])

  return (
    <>
      <CinematicHero city={settings.city} />
      <Introduction city={settings.city} />
      <SignatureServices services={services} gallery={gallery} phone={settings.phone} />
      <Transformations gallery={gallery} />
      <BeforeAfterSection gallery={gallery} />
      <AboutTeaser />
      <TeamSection stylists={stylists} />
      <ReviewsSection reviews={reviews} />
      <CtaBand />
      <VisitSection settings={settings} hours={hours} />
    </>
  )
}
