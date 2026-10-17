import type { AppointmentStatus } from '@/lib/types'

/**
 * One vocabulary for appointment states everywhere. "Pending" is always shown
 * as a request awaiting confirmation, never as a confirmed booking.
 */
export const STATUS: Record<AppointmentStatus, { label: string; customerLabel: string; className: string }> = {
  pending: {
    label: 'Pending',
    customerLabel: 'Requested — awaiting confirmation',
    className: 'bg-amber-100 text-amber-900 ring-amber-300',
  },
  confirmed: { label: 'Confirmed', customerLabel: 'Confirmed', className: 'bg-emerald-100 text-emerald-900 ring-emerald-300' },
  completed: { label: 'Completed', customerLabel: 'Completed', className: 'bg-stone-200 text-stone-800 ring-stone-300' },
  cancelled: { label: 'Cancelled', customerLabel: 'Cancelled', className: 'bg-rose-100 text-rose-900 ring-rose-300' },
  no_show: { label: 'No-show', customerLabel: 'Missed', className: 'bg-zinc-200 text-zinc-800 ring-zinc-300' },
}
