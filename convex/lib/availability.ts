/**
 * The booking engine's availability rules, as pure functions over a stylist's
 * day. booking.ts and appointments.ts load the data; these decide.
 *
 *   checkSlot  — can this stylist take [start, start+duration(+buffer))?
 *   freeSlots  — every bookable start on a salon-local date.
 *   dayIsOpen  — is the stylist scheduled and not fully away (calendar view)?
 *
 * The service itself must fit inside working hours and avoid breaks; service +
 * clean-up buffer must avoid time off and other live appointments.
 */
import { localTs, MINUTE, type IsoDate } from './time'

export type Period = { startsAt: string; endsAt: string } // salon-local "HH:MM"
export type Hours = { isClosed: boolean; opensAt?: string; closesAt?: string }
export type Interval = { start: number; end: number } // epoch ms, half-open

export type StylistDay = {
  date: IsoDate
  /** The salon's opening hours that weekday (null = no row, treated as closed). */
  hours: Hours | null
  shifts: Period[]
  breaks: Period[]
  /** The stylist's own time off plus salon-wide closures. */
  timeOff: Interval[]
  /** Live (pending/confirmed) appointments: start → blockedUntil. */
  busy: (Interval & { id: string })[]
}

export type SlotProblem = 'OUTSIDE_HOURS' | 'ON_BREAK' | 'TIME_OFF' | 'OVERLAP'

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end

/** Each shift clipped to the salon's opening hours, as absolute instants. */
export function workingWindows(day: StylistDay): Interval[] {
  const { hours } = day
  if (!hours || hours.isClosed || !hours.opensAt || !hours.closesAt) return []
  const open = localTs(day.date, hours.opensAt)
  const close = localTs(day.date, hours.closesAt)
  return day.shifts
    .map((s) => ({ start: Math.max(localTs(day.date, s.startsAt), open), end: Math.min(localTs(day.date, s.endsAt), close) }))
    .filter((w) => w.start < w.end)
}

export function checkSlot(
  day: StylistDay,
  start: number,
  durationMin: number,
  bufferMin: number,
  ignoreAppointmentId?: string,
): SlotProblem | null {
  const service = { start, end: start + durationMin * MINUTE }
  const blocked = { start, end: service.end + bufferMin * MINUTE }

  if (!workingWindows(day).some((w) => service.start >= w.start && service.end <= w.end)) return 'OUTSIDE_HOURS'
  if (day.breaks.some((b) => overlaps({ start: localTs(day.date, b.startsAt), end: localTs(day.date, b.endsAt) }, service))) {
    return 'ON_BREAK'
  }
  if (day.timeOff.some((t) => overlaps(t, blocked))) return 'TIME_OFF'
  if (day.busy.some((a) => a.id !== ignoreAppointmentId && overlaps(a, blocked))) return 'OVERLAP'
  return null
}

/** All starts on the slot grid (counted from each window's start) that pass checkSlot, ascending. */
export function freeSlots(
  day: StylistDay,
  durationMin: number,
  bufferMin: number,
  intervalMin: number,
  ignoreAppointmentId?: string,
): number[] {
  const found = new Set<number>()
  for (const w of workingWindows(day)) {
    for (let t = w.start; t <= w.end - durationMin * MINUTE; t += intervalMin * MINUTE) {
      if (checkSlot(day, t, durationMin, bufferMin, ignoreAppointmentId) === null) found.add(t)
    }
  }
  return [...found].sort((a, b) => a - b)
}

/**
 * True when at least one working window that day is not entirely covered by a
 * single time-off period. Used to grey out calendar days; exact slots are
 * fetched per day.
 */
export function dayIsOpen(day: StylistDay): boolean {
  return workingWindows(day).some((w) => !day.timeOff.some((t) => t.start <= w.start && t.end >= w.end))
}
