import { heroFilm } from '@/config/media'
import { ButtonLink } from '@/components/ui/Button'
import { VideoBackground } from './VideoBackground'

/**
 * Homepage hero: the film fills the full width below the fixed header at 16:9,
 * capped to the viewport height, so on wide, short screens a little of the top
 * and bottom is trimmed; phones and tablets show the whole frame. On laptops
 * and wider the headline reads over the film's lower-left corner; on phones
 * and tablets it follows underneath so nothing covers the film.
 */
export function CinematicHero({ city }: { city: string }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate bg-charcoal pt-20 text-ivory">
      <div className="relative w-full">
        <div className="film-grain relative aspect-video max-h-[calc(100svh-5rem)] w-full overflow-hidden">
          {/* When the height cap trims the frame, keep the faces near the top and trim mostly from the bottom. */}
          <VideoBackground
            asset={heroFilm}
            priority
            mediaClassName="object-[50%_20%]"
            controlLabel="hero film"
            controlClassName="bottom-3 right-3 xl:bottom-6 xl:right-6"
          />

          {/* Grade only behind the large-screen copy; the rest of the film stays clear. */}
          <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-tr from-charcoal/85 via-charcoal/30 via-35% to-transparent to-60% xl:block" />
        </div>

        <div className="container-x relative z-10 pb-16 pt-10 xl:absolute xl:inset-x-0 xl:bottom-0 xl:pb-14 xl:pt-0">
          <div className="max-w-3xl xl:max-w-[32rem]">
            {/* Over the film the grade is light, so a soft shadow keeps the copy legible on bright frames. */}
            <p className="eyebrow animate-fade-up text-gold [animation-delay:150ms] xl:text-shadow-md xl:text-shadow-charcoal/80">Orange Salon · {city}</p>
            <h1
              id="hero-title"
              className="display mt-6 animate-fade-up text-[2.75rem] leading-[1.04] [animation-delay:300ms] sm:text-6xl xl:mt-4 xl:text-[3.5rem] xl:text-shadow-lg xl:text-shadow-charcoal/50"
            >
              <span className="block md:whitespace-nowrap xl:whitespace-normal">
                Your Hair. <span className="xl:block">Your Style.</span>
              </span>
              <span className="block">
                Your <span className="text-gold">Confidence.</span>
              </span>
            </h1>
            <p className="mt-7 max-w-md animate-fade-up text-[1.0625rem] leading-relaxed text-ivory/80 [animation-delay:500ms] xl:mt-5 xl:text-shadow-md xl:text-shadow-charcoal/80">
              Discover exceptional styling, beautiful color, and personalized hair care in the heart of {city}.
            </p>
            <div className="mt-10 flex animate-fade-up flex-col gap-3 [animation-delay:700ms] sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 xl:mt-7">
              <ButtonLink href="/services" size="lg" arrow>
                Explore Our Services
              </ButtonLink>
              <ButtonLink href="/book" variant="outline-light" size="lg">
                Book Your Appointment
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
