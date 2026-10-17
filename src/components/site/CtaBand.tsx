import { ambientFilm } from '@/config/media'
import { ButtonLink } from '@/components/ui/Button'
import { VideoBackground } from './VideoBackground'

/** "Ready for your next look?" band over slow braid movement (plays only in view). */
export function CtaBand() {
  return (
    <section aria-labelledby="cta-title" className="film-grain relative isolate overflow-hidden bg-charcoal text-ivory">
      <VideoBackground asset={ambientFilm} controlLabel="background video" controlClassName="bottom-4 right-4" />
      <div aria-hidden className="absolute inset-0 bg-charcoal/75" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/60 to-charcoal/80" />
      <div className="container-x relative z-10 flex flex-col gap-8 py-20 md:flex-row md:items-center md:justify-between md:py-24">
        <div>
          <h2 id="cta-title" className="display text-4xl md:text-5xl">
            Ready for your next look?
          </h2>
          <p className="mt-4 max-w-md text-ivory/70">
            Book your appointment today and let our team bring your hair vision to life.
          </p>
        </div>
        <ButtonLink href="/book" size="lg" arrow className="self-start md:self-auto">
          Book Appointment
        </ButtonLink>
      </div>
    </section>
  )
}
