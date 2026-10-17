'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, TextArea } from '@/components/ui/Field'
import { addDays, formatDateLong, formatIsoDate, formatTime, salonDate } from '@/lib/time'
import type { CustomerBooking } from '@/lib/types'
import { BookingDetails } from './BookingDetails'
import { Calendar } from './Calendar'
import { TimeSlots } from './TimeSlots'
import { apiFetch, useSlots } from './useAvailability'

export function ManageBooking({
  booking: initial,
  location,
  maxAdvanceDays,
  phone,
}: {
  booking: CustomerBooking
  location: string
  maxAdvanceDays: number
  phone: string | null
}) {
  const router = useRouter()
  const [booking, setBooking] = useState(initial)
  const [mode, setMode] = useState<'view' | 'reschedule'>('view')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const today = salonDate()
  const maxDate = addDays(today, maxAdvanceDays)
  const [month, setMonth] = useState(() => {
    const [y, m] = today.split('-').map(Number)
    return { year: y, monthIndex: m - 1 }
  })
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const { slots, loading, error } = useSlots(mode === 'reschedule' && date ? `/api/booking/manage?date=${date}` : null, reload)

  // Every date in the window is offered; each day then shows its real times.
  const allDays = useMemo(() => {
    const set = new Set<string>()
    for (let d = today; d <= maxDate; d = addDays(d, 1)) set.add(d)
    return set
  }, [today, maxDate])

  const post = async (body: unknown, success: string) => {
    setBusy(true)
    const result = await apiFetch<{ booking: CustomerBooking }>('/api/booking/manage', { method: 'POST', body: JSON.stringify(body) })
    setBusy(false)
    if (result.error) {
      toast.error(result.error.message)
      if (result.error.code === 'SLOT_TAKEN' || result.error.code === 'SLOT_UNAVAILABLE') {
        setTime(null)
        setReload((n) => n + 1)
      }
      return false
    }
    setBooking(result.data.booking)
    toast.success(success)
    router.refresh()
    return true
  }

  const changeable = booking.canCancel || booking.canReschedule
  const deadline = `${formatDateLong(booking.changeDeadline)} at ${formatTime(booking.changeDeadline)}`

  return (
    <div className="space-y-8">
      <BookingDetails booking={booking} location={location} />

      {mode === 'view' && (
        <div className="rounded-sm border border-charcoal/10 bg-white p-6">
          <h2 className="font-serif text-xl">Need to make a change?</h2>
          {changeable ? (
            <>
              <p className="mt-2 text-sm text-taupe-700">You can change or cancel online until {deadline}.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {booking.canReschedule && (
                  <Button variant="dark" onClick={() => setMode('reschedule')}>
                    Change date or time
                  </Button>
                )}
                {booking.canCancel && (
                  <Button variant="outline-dark" onClick={() => setCancelOpen(true)}>
                    Cancel appointment
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-taupe-700">
              {booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show'
                ? 'This appointment can no longer be changed.'
                : 'It’s too close to your appointment to change it online.'}
              {phone && ' Please call the salon if you need help.'}
            </p>
          )}
        </div>
      )}

      {mode === 'reschedule' && (
        <section aria-labelledby="reschedule-title" className="rounded-sm border border-charcoal/10 bg-white p-6">
          <h2 id="reschedule-title" className="font-serif text-2xl">Choose a new time</h2>
          <p className="mt-1 text-sm text-taupe-700">
            Same service and stylist. Moving your appointment sends it back to the salon for confirmation.
          </p>
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <Calendar
              month={month}
              onMonthChange={setMonth}
              minDate={today}
              maxDate={maxDate}
              bookable={allDays}
              selected={date}
              onSelect={(d) => {
                setDate(d)
                setTime(null)
              }}
            />
            <div>
              <h3 className="mb-4 font-serif text-xl">{date ? formatIsoDate(date) : 'Available times'}</h3>
              <TimeSlots slots={date ? slots : null} loading={loading} error={error} selected={time} onSelect={setTime} onRetry={() => setReload((n) => n + 1)} />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              disabled={!time || busy}
              aria-busy={busy}
              onClick={async () => {
                if (time && (await post({ action: 'reschedule', startsAt: time }, 'Your appointment has been moved.'))) {
                  setMode('view')
                  setDate(null)
                  setTime(null)
                }
              }}
            >
              {busy ? 'Saving…' : time ? `Move to ${formatTime(time)}` : 'Choose a time'}
            </Button>
            <Button variant="ghost-dark" onClick={() => setMode('view')}>
              Keep current time
            </Button>
          </div>
        </section>
      )}

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this appointment?"
        description={`${booking.serviceName} on ${formatDateLong(booking.startsAt)} at ${formatTime(booking.startsAt)}.`}
      >
        <Field label="Reason" optional hint="Helps us improve — never required.">
          {({ id, describedBy }) => (
            <TextArea id={id} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby={describedBy} />
          )}
        </Field>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost-dark" onClick={() => setCancelOpen(false)}>
            Keep appointment
          </Button>
          <Button
            variant="dark"
            disabled={busy}
            aria-busy={busy}
            onClick={async () => {
              if (await post({ action: 'cancel', reason }, 'Your appointment has been cancelled.')) setCancelOpen(false)
            }}
          >
            {busy ? 'Cancelling…' : 'Yes, cancel it'}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
