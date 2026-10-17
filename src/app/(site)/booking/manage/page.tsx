import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LookupForm } from '@/components/booking/LookupForm'
import { ManageBooking } from '@/components/booking/ManageBooking'
import { currentBookingAccess, lookupBooking } from '@/lib/booking/server'
import { getSettings } from '@/lib/data/public'

export const metadata: Metadata = {
  title: 'Manage your booking',
  description: 'View, reschedule or cancel your Orange Salon appointment with your booking reference.',
  robots: { index: false, follow: true },
}

export default function ManageBookingPage() {
  return (
    <section className="min-h-[80vh] bg-ivory pt-32 pb-24 md:pt-40">
      <div className="container-x max-w-3xl">
        <Suspense fallback={<div aria-busy="true" className="h-96 animate-pulse rounded-sm bg-ivory-300" />}>
          <Manage />
        </Suspense>
      </div>
    </section>
  )
}

async function Manage() {
  const [access, settings] = await Promise.all([currentBookingAccess(), getSettings()])
  const booking = access ? await lookupBooking(access.reference, access.phone) : null
  const location = [settings.name, settings.addressLine, settings.city].filter(Boolean).join(', ')

  if (!booking) {
    return (
      <div>
        <p className="eyebrow text-gold-700">Manage your booking</p>
        <h1 className="display mt-4 text-4xl md:text-5xl">Find your appointment</h1>
        <p className="mt-4 max-w-lg text-taupe-700">
          Enter your booking reference and the phone number you booked with to view, move or cancel your appointment.
        </p>
        <div className="mt-10 max-w-md">
          <LookupForm />
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="eyebrow text-gold-700">Manage your booking</p>
      <h1 className="display mt-4 mb-10 text-4xl md:text-5xl">Hello, {booking.customerName.split(' ')[0]}</h1>
      <ManageBooking booking={booking} location={location} maxAdvanceDays={settings.maxAdvanceDays} phone={settings.phone} />
    </div>
  )
}
