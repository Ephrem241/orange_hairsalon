import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { CheckCircle2, Clock3 } from 'lucide-react'
import { BookingDetails } from '@/components/booking/BookingDetails'
import { LookupForm } from '@/components/booking/LookupForm'
import { ButtonAnchor, ButtonLink } from '@/components/ui/Button'
import { currentBookingAccess, lookupBooking } from '@/lib/booking/server'
import { getSettings } from '@/lib/data/public'
import { formatPhone, telHref } from '@/lib/format'
import { referenceSchema } from '@/lib/validation'

export const metadata: Metadata = { title: 'Your booking', robots: { index: false, follow: false } }

export default function ConfirmationPage({ params }: PageProps<'/booking/confirmation/[reference]'>) {
  return (
    <section className="min-h-[80vh] bg-ivory pt-32 pb-24 md:pt-40">
      <div className="container-x max-w-3xl">
        <Suspense fallback={<div aria-busy="true" className="h-96 animate-pulse rounded-sm bg-ivory-300" />}>
          <Confirmation params={params} />
        </Suspense>
      </div>
    </section>
  )
}

async function Confirmation({ params }: Pick<PageProps<'/booking/confirmation/[reference]'>, 'params'>) {
  const { reference: raw } = await params
  const parsed = referenceSchema.safeParse(decodeURIComponent(raw))
  const reference = parsed.success ? parsed.data : null
  const [access, settings] = await Promise.all([currentBookingAccess(), getSettings()])

  // The URL alone reveals nothing: the encrypted cookie (set when booking or
  // after a phone check) must match this reference.
  const booking = reference && access?.reference === reference ? await lookupBooking(reference, access.phone) : null
  const location = [settings.name, settings.addressLine, settings.city].filter(Boolean).join(', ')

  if (!booking) {
    return (
      <div>
        <h1 className="display text-4xl">View your booking</h1>
        <p className="mt-4 text-taupe-700">For your privacy, please confirm the phone number you booked with.</p>
        <div className="mt-8 max-w-md">
          <LookupForm initialReference={reference ?? ''} />
        </div>
      </div>
    )
  }

  const confirmed = booking.status === 'confirmed'
  return (
    <div>
      <div className="flex items-start gap-4">
        {confirmed ? (
          <CheckCircle2 aria-hidden className="mt-1 size-9 shrink-0 text-emerald-700" />
        ) : (
          <Clock3 aria-hidden className="mt-1 size-9 shrink-0 text-gold-700" />
        )}
        <div>
          <p className="eyebrow text-gold-700">{confirmed ? 'Booking confirmed' : 'Request received'}</p>
          <h1 className="display mt-3 text-4xl md:text-5xl">
            {confirmed ? 'You’re booked in.' : 'Thank you — your request is in.'}
          </h1>
          <p className="mt-4 max-w-xl text-taupe-700">
            {confirmed
              ? 'We look forward to seeing you. Keep your booking reference to view or change your appointment.'
              : 'Your appointment is not confirmed yet. Our team will review your request and confirm it — we’ll contact you if anything needs to change. Keep your booking reference handy.'}
          </p>
        </div>
      </div>

      <div className="mt-10">
        <BookingDetails booking={booking} location={location} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/booking/manage" variant="dark">
          Manage booking
        </ButtonLink>
        {settings.phone && (
          <ButtonAnchor href={telHref(settings.phone)} variant="outline-dark">
            Call {formatPhone(settings.phone)}
          </ButtonAnchor>
        )}
      </div>
      <p className="mt-8 text-sm text-taupe-700">
        Payment is taken at the salon.{' '}
        <Link href="/terms" className="underline underline-offset-4">
          Booking terms
        </Link>
      </p>
    </div>
  )
}
