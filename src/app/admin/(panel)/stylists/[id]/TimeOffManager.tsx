'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatDateShort, formatTime, salonDate } from '@/lib/time'
import { addTimeOff, deleteTimeOff } from '../actions'

type Entry = { id: string; startsAt: string; endsAt: string; reason: string | null }

/** Time off for a stylist, or (stylistId = null) salon-wide closures such as public holidays. */
export function TimeOffManager({ stylistId, entries }: { stylistId: string | null; entries: Entry[] }) {
  const today = salonDate()
  const [v, setV] = useState({ startDate: today, startTime: '00:00', endDate: today, endTime: '23:59', reason: '' })
  const [pending, start] = useTransition()
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }))

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="text-sm text-taupe-700">Nothing scheduled.</p>
      ) : (
        <ul className="divide-y divide-charcoal/5 rounded-sm border border-charcoal/10">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                {formatDateShort(e.startsAt)} {formatTime(e.startsAt)} → {formatDateShort(e.endsAt)} {formatTime(e.endsAt)}
                {e.reason && <span className="block text-xs text-taupe-700">{e.reason}</span>}
              </span>
              <button
                type="button"
                aria-label="Remove"
                disabled={pending}
                onClick={() => start(async () => { const r = await deleteTimeOff(e.id, stylistId === null); if (r.ok) toast.success(r.message); else toast.error(r.error) })}
                className="inline-flex size-8 items-center justify-center rounded-sm text-taupe-700 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid grid-cols-2 gap-2 rounded-sm bg-ivory-200/60 p-3 text-sm sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            const r = await addTimeOff({ stylistId, ...v })
            if (r.ok) {
              toast.success(r.message)
              set({ reason: '' })
            } else toast.error(r.error)
          })
        }}
      >
        <label className="text-xs text-taupe-700">From<input type="date" value={v.startDate} min={today} onChange={(e) => set({ startDate: e.target.value, endDate: e.target.value > v.endDate ? e.target.value : v.endDate })} className="mt-1 block h-9 w-full rounded-sm border border-charcoal/20 bg-white px-2 text-charcoal" /></label>
        <label className="text-xs text-taupe-700">Time<input type="time" value={v.startTime} onChange={(e) => set({ startTime: e.target.value })} className="mt-1 block h-9 w-full rounded-sm border border-charcoal/20 bg-white px-2 text-charcoal" /></label>
        <label className="text-xs text-taupe-700">To<input type="date" value={v.endDate} min={v.startDate} onChange={(e) => set({ endDate: e.target.value })} className="mt-1 block h-9 w-full rounded-sm border border-charcoal/20 bg-white px-2 text-charcoal" /></label>
        <label className="text-xs text-taupe-700">Time<input type="time" value={v.endTime} onChange={(e) => set({ endTime: e.target.value })} className="mt-1 block h-9 w-full rounded-sm border border-charcoal/20 bg-white px-2 text-charcoal" /></label>
        <label className="col-span-2 text-xs text-taupe-700 sm:col-span-3">Reason<input value={v.reason} maxLength={200} onChange={(e) => set({ reason: e.target.value })} placeholder={stylistId ? 'Leave, training…' : 'Public holiday…'} className="mt-1 block h-9 w-full rounded-sm border border-charcoal/20 bg-white px-2 text-charcoal" /></label>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <Button type="submit" variant="dark" size="sm" className="w-full" disabled={pending}>Add</Button>
        </div>
      </form>
    </div>
  )
}
