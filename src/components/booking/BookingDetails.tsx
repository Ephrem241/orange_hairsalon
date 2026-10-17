'use client'

import { CalendarPlus } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDuration, formatEtb } from '@/lib/format'
import { buildIcs } from '@/lib/ics'
import { formatDateLong, formatTime } from '@/lib/time'
import type { CustomerBooking } from '@/lib/types'

export function BookingDetails({ booking, location }: { booking: CustomerBooking; location: string }) {
  const addToCalendar = () => {
    const ics = buildIcs({
      uid: `${booking.reference}@orange-salon`,
      start: booking.startsAt,
      end: booking.endsAt,
      summary: `${booking.serviceName} — Orange Salon`,
      location,
      description: `Booking reference ${booking.reference}${booking.status === 'pending' ? ' (awaiting confirmation)' : ''}`,
    })
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `orange-salon-${booking.reference}.ics` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="overflow-hidden rounded-sm border border-charcoal/10 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-charcoal/10 bg-ivory-200 px-6 py-5">
        <div>
          <p className="text-xs tracking-wide text-taupe-700 uppercase">Booking reference</p>
          <p className="mt-1 font-mono text-2xl tracking-[0.12em] text-charcoal">{booking.reference}</p>
        </div>
        <StatusBadge status={booking.status} audience="customer" />
      </div>
      <dl className="grid gap-x-8 gap-y-5 px-6 py-6 sm:grid-cols-2">
        <Item label="Service" value={booking.serviceName} />
        <Item label="Stylist" value={booking.stylistName ?? 'Assigned by the salon'} />
        <Item label="Date" value={formatDateLong(booking.startsAt)} />
        <Item label="Time" value={`${formatTime(booking.startsAt)} – ${formatTime(booking.endsAt)}`} />
        <Item label="Duration" value={formatDuration(booking.durationMin)} />
        <Item label="Price" value={`${formatEtb(booking.priceEtb, booking.priceType)} · paid at the salon`} />
      </dl>
      {(booking.status === 'pending' || booking.status === 'confirmed') && (
        <div className="border-t border-charcoal/10 px-6 py-4">
          <button type="button" onClick={addToCalendar} className="inline-flex items-center gap-2 text-sm font-medium text-gold-700 hover:underline">
            <CalendarPlus aria-hidden className="size-4" /> Add to calendar
          </button>
        </div>
      )}
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-taupe-700 uppercase">{label}</dt>
      <dd className="mt-1 text-charcoal">{value}</dd>
    </div>
  )
}
