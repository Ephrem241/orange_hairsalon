import { formatClock } from '@/lib/time'
import type { BusinessHours } from '@/lib/types'

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]

const describe = (h: BusinessHours | undefined) =>
  !h || h.isClosed || !h.opensAt || !h.closesAt ? 'Closed' : `${formatClock(h.opensAt)} – ${formatClock(h.closesAt)}`

/**
 * Collapse a week of opening hours into readable rows, Monday first:
 * [{ days: 'Mon – Sat', hours: '8:00 AM – 8:00 PM' }, { days: 'Sun', hours: '9:00 AM – 7:30 PM' }]
 */
export function groupHours(hours: BusinessHours[]): { days: string; hours: string }[] {
  const byDay = new Map(hours.map((h) => [h.weekday, h]))
  const rows: { start: number; end: number; hours: string }[] = []
  for (const day of MONDAY_FIRST) {
    const value = describe(byDay.get(day))
    const last = rows.at(-1)
    if (last && last.hours === value) last.end = day
    else rows.push({ start: day, end: day, hours: value })
  }
  return rows.map((r) => ({
    days: r.start === r.end ? SHORT[r.start] : `${SHORT[r.start]} – ${SHORT[r.end]}`,
    hours: r.hours,
  }))
}

export const weekdayName = (weekday: number) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday]
