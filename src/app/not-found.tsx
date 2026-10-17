import Link from 'next/link'
import { Wordmark } from '@/components/site/Wordmark'
import { ButtonLink } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <main className="film-grain relative flex min-h-dvh flex-col items-center justify-center bg-charcoal px-6 text-center text-ivory">
      <Link href="/" aria-label="Orange Salon — home">
        <Wordmark />
      </Link>
      <p className="eyebrow mt-16 text-gold">404</p>
      <h1 className="display mt-4 text-5xl">This page has moved on</h1>
      <p className="mt-4 max-w-md text-ivory/70">The page you were looking for doesn’t exist. Let’s get you back to something beautiful.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Home</ButtonLink>
        <ButtonLink href="/book" variant="outline-light">
          Book an appointment
        </ButtonLink>
      </div>
    </main>
  )
}
