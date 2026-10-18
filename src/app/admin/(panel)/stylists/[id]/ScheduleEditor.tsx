'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { setStylistSchedule } from '../actions'

type Period = { weekday: number; start: string; end: string; label?: string }

const DAYS = [
  { weekday: 1, name: 'Monday' },
  { weekday: 2, name: 'Tuesday' },
  { weekday: 3, name: 'Wednesday' },
  { weekday: 4, name: 'Thursday' },
  { weekday: 5, name: 'Friday' },
  { weekday: 6, name: 'Saturday' },
  { weekday: 0, name: 'Sunday' },
]

/** Weekly working periods (split shifts allowed) and breaks, saved together atomically. */
export function ScheduleEditor({ stylistId, hours: initialHours, breaks: initialBreaks }: { stylistId: string; hours: Period[]; breaks: Period[] }) {
  const [hours, setHours] = useState(initialHours)
  const [breaks, setBreaks] = useState(initialBreaks)
  const [pending, start] = useTransition()

  const copyMondayToWeekdays = () => {
    const mon = hours.filter((h) => h.weekday === 1)
    const monBreaks = breaks.filter((b) => b.weekday === 1)
    const weekdays = [2, 3, 4, 5, 6]
    setHours([...hours.filter((h) => !weekdays.includes(h.weekday)), ...weekdays.flatMap((d) => mon.map((h) => ({ ...h, weekday: d })))])
    setBreaks([...breaks.filter((b) => !weekdays.includes(b.weekday)), ...weekdays.flatMap((d) => monBreaks.map((b) => ({ ...b, weekday: d })))])
  }

  const save = () =>
    start(async () => {
      const r = await setStylistSchedule(
        stylistId,
        hours.map((h) => ({ weekday: h.weekday, startsAt: h.start, endsAt: h.end })),
        breaks.map((b) => ({ weekday: b.weekday, startsAt: b.start, endsAt: b.end, label: b.label || undefined })),
      )
      if (r.ok) toast.success(r.message)
      else toast.error(r.error)
    })

  return (
    <div>
      <p className="mb-4 text-sm text-taupe-700">
        Online slots are offered only inside these hours <em>and</em> the salon’s opening hours. Breaks block appointments.
      </p>
      <div className="divide-y divide-charcoal/5 rounded-sm border border-charcoal/10">
        {DAYS.map(({ weekday, name }) => (
          <div key={weekday} className="grid gap-3 px-4 py-3 md:grid-cols-[8rem_1fr_1fr] md:items-start">
            <p className="pt-1.5 text-sm font-medium">{name}</p>
            <PeriodList label="Working" periods={hours} weekday={weekday} onChange={setHours} defaults={{ start: '09:00', end: '18:00' }} />
            <PeriodList label="Breaks" periods={breaks} weekday={weekday} onChange={setBreaks} defaults={{ start: '13:00', end: '14:00' }} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="dark" disabled={pending} onClick={save}>{pending ? 'Saving…' : 'Save weekly schedule'}</Button>
        <Button variant="outline-dark" onClick={copyMondayToWeekdays}>Copy Monday to Tue–Sat</Button>
      </div>
    </div>
  )
}

function PeriodList({
  label, periods, weekday, onChange, defaults,
}: {
  label: string
  periods: Period[]
  weekday: number
  onChange: (next: Period[]) => void
  defaults: { start: string; end: string }
}) {
  const mine = periods.map((p, index) => ({ p, index })).filter(({ p }) => p.weekday === weekday)
  const update = (index: number, patch: Partial<Period>) => onChange(periods.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  return (
    <div>
      <p className="mb-1 text-xs text-taupe-700">{label}</p>
      <div className="space-y-2">
        {mine.length === 0 && <p className="text-sm text-taupe-700/70">{label === 'Working' ? 'Not working' : 'No breaks'}</p>}
        {mine.map(({ p, index }) => (
          <div key={index} className="flex items-center gap-2">
            <input type="time" aria-label={`${label} start`} value={p.start} onChange={(e) => update(index, { start: e.target.value })} className="h-9 rounded-sm border border-charcoal/20 px-2 text-sm" />
            <span className="text-taupe-700">–</span>
            <input type="time" aria-label={`${label} end`} value={p.end} onChange={(e) => update(index, { end: e.target.value })} className="h-9 rounded-sm border border-charcoal/20 px-2 text-sm" />
            <button type="button" aria-label={`Remove ${label.toLowerCase()} period`} onClick={() => onChange(periods.filter((_, i) => i !== index))} className="inline-flex size-8 items-center justify-center rounded-sm text-taupe-700 hover:bg-red-50 hover:text-red-700">
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...periods, { weekday, ...defaults }])} className="inline-flex items-center gap-1 text-xs text-gold-700 hover:underline">
          <Plus aria-hidden className="size-3" /> Add {label === 'Working' ? 'period' : 'break'}
        </button>
      </div>
    </div>
  )
}
