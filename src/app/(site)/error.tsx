'use client'

import { Button, ButtonLink } from '@/components/ui/Button'

export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="flex min-h-[70vh] items-center bg-ivory pt-24">
      <div className="container-x max-w-xl text-center">
        <p className="eyebrow text-gold-700">Something went wrong</p>
        <h1 className="display mt-4 text-4xl">We couldn’t load this page</h1>
        <p className="mt-4 text-taupe-700">Please try again. If it keeps happening, call the salon and we’ll help you directly.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="outline-dark">
            Home
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}
