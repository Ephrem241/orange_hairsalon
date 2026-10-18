import { heroFilm } from '@/config/media'
import { ButtonLink } from '@/components/ui/Button'
import { VideoBackground } from './VideoBackground'

/**
 * Homepage hero: full-viewport film with a left-weighted charcoal grade so the
 * headline reads like a campaign title card rather than text over a video.
 */
export function CinematicHero({ city }: { city: string }) {
  return (
    <section aria-labelledby="hero-title" className="film-grain relative isolate flex min-h-[100svh] items-end overflow-hidden bg-charcoal text-ivory md:items-center">
      <VideoBackground asset={heroFilm} priority controlLabel="hero film" controlClassName="bottom-8 right-5 md:right-10" />

      {/* Grade: deep on the left for the copy, open on the right for the film. */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-charcoal/90 via-charcoal/55 to-charcoal/10" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/20 to-charcoal/40" />

      <div className="container-x relative z-10 pb-28 pt-32 md:pb-24">
        <div className="max-w-3xl">
          <p className="eyebrow animate-fade-up text-gold [animation-delay:150ms]">Orange Salon · {city}</p>
          <h1
            id="hero-title"
            className="display mt-6 animate-fade-up text-[2.75rem] leading-[1.04] [animation-delay:300ms] sm:text-6xl lg:text-[4.5rem]"
          >
            <span className="block md:whitespace-nowrap">Your Hair. Your Style.</span>
            <span className="block">
              Your <span className="text-gold">Confidence.</span>
            </span>
          </h1>
          <p className="mt-7 max-w-md animate-fade-up text-[1.0625rem] leading-relaxed text-ivory/80 [animation-delay:500ms]">
            Discover exceptional styling, beautiful color, and personalized hair care in the heart of {city}.
          </p>
          <div className="mt-10 flex animate-fade-up flex-col gap-3 [animation-delay:700ms] sm:flex-row sm:items-center sm:gap-4">
            <ButtonLink href="/services" size="lg" arrow>
              Explore Our Services
            </ButtonLink>
            <ButtonLink href="/book" variant="outline-light" size="lg">
              Book Your Appointment
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  )
}
