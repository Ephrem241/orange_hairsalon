'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { addDays, formatIsoDate, monthGrid, type IsoDate } from '@/lib/time'

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type Props = {
  month: { year: number; monthIndex: number }
  onMonthChange: (month: { year: number; monthIndex: number }) => void
  minDate: IsoDate
  maxDate: IsoDate
  /** Dates known to have availability; null while loading. */
  bookable: Set<IsoDate> | null
  selected: IsoDate | null
  onSelect: (date: IsoDate) => void
}

const monthKey = (year: number, monthIndex: number) => year * 12 + monthIndex

/** Month grid date picker (Monday first, salon calendar). Arrow keys move between days. */
export function Calendar({ month, onMonthChange, minDate, maxDate, bookable, selected, onSelect }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  const weeks = monthGrid(month.year, month.monthIndex)
  const [minY, minM] = minDate.split('-').map(Number)
  const [maxY, maxM] = maxDate.split('-').map(Number)
  const current = monthKey(month.year, month.monthIndex)
  const canPrev = current > monthKey(minY, minM - 1)
  const canNext = current < monthKey(maxY, maxM - 1)

  const shift = (delta: number) => {
    const total = current + delta
    onMonthChange({ year: Math.floor(total / 12), monthIndex: total % 12 })
  }

  const isEnabled = (date: IsoDate) => date >= minDate && date <= maxDate && (bookable?.has(date) ?? false)

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    const delta = deltas[event.key]
    const from = (event.target as HTMLElement).dataset.date
    if (!delta || !from) return
    event.preventDefault()
    let target = addDays(from, delta)
    for (let i = 0; i < 31 && !isEnabled(target) && target >= minDate && target <= maxDate; i++) target = addDays(target, delta)
    const button = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)
    if (button && !button.disabled) button.focus()
  }

  return (
    <div className="rounded-sm border border-charcoal/10 bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl" aria-live="polite">
          {MONTHS[month.monthIndex]} {month.year}
        </h3>
        <div className="flex gap-1">
          <button type="button" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Previous month" className="inline-flex size-10 items-center justify-center rounded-full text-charcoal hover:bg-ivory-200 disabled:opacity-30">
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button type="button" onClick={() => shift(1)} disabled={!canNext} aria-label="Next month" className="inline-flex size-10 items-center justify-center rounded-full text-charcoal hover:bg-ivory-200 disabled:opacity-30">
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
      </div>

      <div ref={gridRef} role="grid" aria-label="Choose a date" className="mt-5" onKeyDown={onKeyDown}>
        <div role="row" className="grid grid-cols-7 text-center text-[0.6875rem] font-medium tracking-wider text-taupe-700 uppercase">
          {WEEKDAY_HEADERS.map((d) => (
            <div role="columnheader" key={d} className="py-2">
              <abbr title={d} className="no-underline">{d}</abbr>
            </div>
          ))}
        </div>
        {weeks.map((week, i) => (
          <div role="row" key={i} className="grid grid-cols-7 gap-1">
            {week.map((date, j) =>
              date ? (
                <div role="gridcell" key={date} aria-selected={selected === date}>
                  <button
                    type="button"
                    data-date={date}
                    disabled={!isEnabled(date)}
                    onClick={() => onSelect(date)}
                    aria-label={`${formatIsoDate(date)}${isEnabled(date) ? '' : bookable ? ', unavailable' : ''}`}
                    aria-pressed={selected === date}
                    className={cn(
                      'relative mx-auto flex aspect-square w-full max-w-12 items-center justify-center rounded-full text-sm tabular-nums transition-colors duration-200',
                      selected === date
                        ? 'bg-charcoal text-ivory'
                        : isEnabled(date)
                          ? 'text-charcoal hover:bg-gold/15 focus-visible:bg-gold/15'
                          : 'cursor-not-allowed text-charcoal/25',
                      !bookable && date >= minDate && date <= maxDate && 'animate-pulse',
                    )}
                  >
                    {Number(date.slice(8))}
                    {isEnabled(date) && selected !== date && <span aria-hidden className="absolute bottom-1.5 size-1 rounded-full bg-gold" />}
                  </button>
                </div>
              ) : (
                <div role="gridcell" key={`pad-${j}`} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
