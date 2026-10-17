import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GalleryExplorer } from '@/components/site/GalleryExplorer'
import { PageHero } from '@/components/site/PageHero'
import { getGallery } from '@/lib/data/public'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Gallery',
  description:
    'Braids, twists, colour and styling by Orange Salon in Addis Ababa — photographs and short films of real client work from our salon.',
  path: '/gallery',
  image: '/images/gallery/copper-passion-twists.jpg',
})

export default async function GalleryPage() {
  const items = await getGallery()
  return (
    <>
      <PageHero
        eyebrow="Our work"
        title="Signature transformations"
        description="Photographed in our salon on Ednamoll Street. Every look here is real Orange Salon client work unless it is labelled illustrative."
        image={{ src: '/images/gallery/copper-passion-twists.jpg', alt: '' }}
        imagePosition="center 35%"
      />
      <section className="bg-charcoal pb-24 text-ivory">
        <div className="container-x">
          {items.length === 0 ? (
            <p className="py-16 text-center text-ivory/70">Our portfolio is being updated — please check back soon.</p>
          ) : (
            <Suspense fallback={<GalleryExplorerFallback count={items.length} />}>
              <GalleryExplorer items={items} />
            </Suspense>
          )}
        </div>
      </section>
    </>
  )
}

function GalleryExplorerFallback({ count }: { count: number }) {
  return (
    <ul className="mt-10 columns-2 gap-3 md:columns-3 md:gap-5 xl:columns-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="mb-3 aspect-[4/5] break-inside-avoid animate-pulse rounded-sm bg-charcoal-700 md:mb-5" />
      ))}
    </ul>
  )
}
