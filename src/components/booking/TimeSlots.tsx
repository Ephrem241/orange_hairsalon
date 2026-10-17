'use client'

import { CalendarX2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatTime, formatTime24 } from '@/lib/time'

export type Slot = { startsAt: string; stylistsFree: number }

const PERIODS = [
  { label: 'Morning', test: (h: number) => h < 12 },
  { label: 'Afternoon', test: (h: number) => h >= 12 && h < 17 },
  { label: 'Evening', test: (h: number) => h >= 17 },
]

export function TimeSlots({
  slots,
  loading,
  error,
  selected,
  onSelect,
  onRetry,
}: {
  slots: Slot[] | null
  loading: boolean
  error: string | null
  selected: string | null
  onSelect: (iso: string) => void
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading available times" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-sm bg-ivory-300" />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <div role="alert" className="rounded-sm border border-red-700/30 bg-red-50 p-5 text-sm text-red-800">
        {error}{' '}
        <button type="button" onClick={onRetry} className="font-medium underline underline-offset-4">
          Try again
        </button>
      </div>
    )
  }
  if (!slots) return <p className="text-sm text-taupe-700">Choose a date to see available times.</p>
  if (slots.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-sm border border-charcoal/10 bg-white p-5 text-sm text-taupe-700">
        <CalendarX2 aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-700" />
        <p>This day is fully booked. Please try another date — or choose “Any available stylist” for more options.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {PERIODS.map((period) => {
        const group = slots.filter((s) => period.test(Number(formatTime24(s.startsAt).slice(0, 2))))
        if (group.length === 0) return null
        return (
          <fieldset key={period.label}>
            <legend className="eyebrow mb-3 text-[0.625rem] text-taupe-700">{period.label}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {group.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  onClick={() => onSelect(slot.startsAt)}
                  aria-pressed={selected === slot.startsAt}
                  className={cn(
                    'h-11 rounded-sm border text-sm tabular-nums transition-colors duration-200',
                    selected === slot.startsAt
                      ? 'border-charcoal bg-charcoal text-ivory'
                      : 'border-charcoal/15 bg-white text-charcoal hover:border-gold-600 hover:text-gold-700',
                  )}
                >
                  {formatTime(slot.startsAt)}
                </button>
              ))}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
