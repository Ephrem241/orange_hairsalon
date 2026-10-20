import Image from 'next/image'
import type { ReactNode } from 'react'
import type { VideoAsset } from '@/config/media'
import { cn } from '@/lib/cn'
import { VideoBackground } from './VideoBackground'

/** Editorial banner for inner pages: a darkened film or photograph behind the title. */
export function PageHero({
  eyebrow,
  title,
  description,
  image,
  imagePosition = 'center',
  video,
  compact = false,
  children,
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  image?: { src: string; alt: string }
  imagePosition?: string
  /** Looping film behind the title; takes the place of `image`. */
  video?: VideoAsset
  compact?: boolean
  children?: ReactNode
}) {
  return (
    <section className={cn('film-grain relative isolate overflow-hidden bg-charcoal text-ivory', compact ? 'pt-36 pb-14' : 'pt-44 pb-20 md:pt-52 md:pb-28')}>
      {video ? (
        <>
          {/* Keep faces near the top of these wide, short banners; the control stays inside the compact padding. */}
          <VideoBackground
            asset={video}
            priority
            mediaClassName="object-[50%_20%]"
            controlLabel="background film"
            controlClassName="bottom-4 right-4"
          />
          {/* The same darkening as the photo's 45% opacity, so the title reads as it does over a still. */}
          <div aria-hidden className="absolute inset-0 bg-charcoal/55" />
        </>
      ) : image && (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          preload
          sizes="100vw"
          className="animate-slow-zoom object-cover opacity-45"
          style={{ objectPosition: imagePosition }}
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/75 to-charcoal/30" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-charcoal to-transparent" />
      <div className="container-x relative z-10">
        <p className="eyebrow animate-fade-up text-gold">{eyebrow}</p>
        <h1 className="display mt-5 max-w-3xl animate-fade-up text-5xl [animation-delay:150ms] md:text-6xl">{title}</h1>
        {description && (
          <div className="mt-6 max-w-xl animate-fade-up text-[1.0625rem] leading-relaxed text-ivory/75 [animation-delay:300ms]">
            {description}
          </div>
        )}
        {children && <div className="mt-9 animate-fade-up [animation-delay:450ms]">{children}</div>}
      </div>
    </section>
  )
}
