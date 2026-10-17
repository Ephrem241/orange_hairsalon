'use client'

import { useEffect, useState, useTransition } from 'react'
import { cn } from '@/lib/cn'
import { formatTime, salonInstant } from '@/lib/time'
import { findStaffSlots, type StaffSlot } from '@/app/admin/(panel)/appointments/actions'

/**
 * Staff time picker: free grid slots for the date (from the database), plus a
 * custom time for walk-ins or off-grid requests — still validated by the
 * database on save.
 */
export function SlotPicker({
  serviceId,
  stylistId,
  date,
  ignoreId,
  value,
  onChange,
  stylistNames,
}: {
  serviceId: string | null
  stylistId: string | null
  date: string
  ignoreId?: string
  value: { startsAt: string; stylistId: string | null } | null
  onChange: (v: { startsAt: string; stylistId: string | null } | null) => void
  stylistNames: Record<string, string>
}) {
  const [slots, setSlots] = useState<StaffSlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [custom, setCustom] = useState('')

  useEffect(() => {
    if (!serviceId || !date) return
    let cancelled = false
    start(async () => {
      const result = await findStaffSlots({ serviceId, stylistId, date, ignoreId })
      if (cancelled) return
      setSlots(result.ok ? (result.data ?? []) : [])
      setError(result.ok ? null : result.error)
    })
    return () => {
      cancelled = true
    }
  }, [serviceId, stylistId, date, ignoreId])

  // Group by start time; with "any stylist" a time may suit several people.
  const byTime = new Map<string, string[]>()
  for (const s of slots ?? []) byTime.set(s.startsAt, [...(byTime.get(s.startsAt) ?? []), s.stylistId])

  if (!serviceId) return <p className="text-sm text-taupe-700">Choose a service first.</p>

  return (
    <div className="space-y-4">
      {pending || slots === null ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded-sm bg-ivory-300" />)}
        </div>
      ) : error ? (
        <p role="alert" className="text-sm text-red-700">{error}</p>
      ) : byTime.size === 0 ? (
        <p className="text-sm text-taupe-700">No free grid times on this date. You can still enter a custom time below.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {[...byTime.entries()].map(([startsAt, ids]) => {
            const chosen = value?.startsAt === startsAt
            const assign = stylistId ?? ids[0]
            return (
              <button
                key={startsAt}
                type="button"
                aria-pressed={chosen}
                title={ids.map((id) => stylistNames[id] ?? 'Stylist').join(', ')}
                onClick={() => onChange({ startsAt, stylistId: assign })}
                className={cn(
                  'h-9 rounded-sm border text-sm tabular-nums transition-colors',
                  chosen ? 'border-charcoal bg-charcoal text-ivory' : 'border-charcoal/15 bg-white hover:border-gold-600',
                )}
              >
                {formatTime(startsAt)}
              </button>
            )
          })}
        </div>
      )}
      {value && !stylistId && value.stylistId && (
        <p className="text-xs text-taupe-700">Assigned to {stylistNames[value.stylistId] ?? 'a stylist'} (first free for this time).</p>
      )}
      <label className="block text-xs font-medium text-taupe-700">
        Custom time {stylistId ? '' : '(choose a stylist for custom times)'}
        <input
          type="time"
          step={300}
          value={custom}
          disabled={!stylistId}
          onChange={(e) => {
            setCustom(e.target.value)
            onChange(e.target.value ? { startsAt: salonInstant(date, e.target.value), stylistId } : null)
          }}
          className="mt-1 block h-10 rounded-sm border border-charcoal/20 px-3 text-sm text-charcoal disabled:bg-ivory-200"
        />
      </label>
    </div>
  )
}
