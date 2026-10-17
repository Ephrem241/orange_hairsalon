/**
 * Salon time helpers. Every calendar date and wall-clock time the salon deals in
 * is Africa/Addis_Ababa; instants travel between browser, server and database
 * as ISO-8601 UTC strings. Addis Ababa is UTC+3 all year (no daylight saving),
 * but conversions go through Intl/TZDate rather than a hardcoded offset.
 */
import { TZDate } from '@date-fns/tz'
import { SALON_TIME_ZONE } from '@/config/site'

/** YYYY-MM-DD */
export type IsoDate = string

const dateKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: SALON_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The salon-local calendar date of an instant. */
export function salonDate(instant: Date | string = new Date()): IsoDate {
  return dateKeyFormat.format(new Date(instant))
}

/** Salon-local date + "HH:MM" → the absolute instant (ISO string). */
export function salonInstant(date: IsoDate, time: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  // TZDate#toISOString keeps the zone offset; the API contract is UTC ("…Z").
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, SALON_TIME_ZONE).getTime()).toISOString()
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** 0 = Sunday … 6 = Saturday, for a calendar date (time-zone independent). */
export function weekdayOf(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const probe = new Date(Date.UTC(y, m - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
}

const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: SALON_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
})
const time24Format = new Intl.DateTimeFormat('en-GB', {
  timeZone: SALON_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const longDateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: SALON_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const shortDateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: SALON_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

/** "2:30 PM" in salon time. */
export const formatTime = (instant: Date | string) => timeFormat.format(new Date(instant))
/** "14:30" in salon time. */
export const formatTime24 = (instant: Date | string) => time24Format.format(new Date(instant))
/** "Monday, 19 October 2026" in salon time. */
export const formatDateLong = (instant: Date | string) => longDateFormat.format(new Date(instant))
/** "Mon, 19 Oct" in salon time. */
export const formatDateShort = (instant: Date | string) => shortDateFormat.format(new Date(instant))

/** A calendar date rendered without any time-zone shift. */
export function formatIsoDate(date: IsoDate, style: 'long' | 'short' = 'long'): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    ...(style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { weekday: 'short', day: 'numeric', month: 'short' }),
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** Whether an instant is now or in the past (request-time check). */
export const hasStarted = (instant: Date | string) => new Date(instant).getTime() <= Date.now()

/** "08:00" → "8:00 AM" */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** Weeks (Monday-first) covering a month, as ISO dates; null pads outside days. */
export function monthGrid(year: number, monthIndex: number): (IsoDate | null)[][] {
  const first = new Date(Date.UTC(year, monthIndex, 1))
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const lead = (first.getUTCDay() + 6) % 7 // Monday = 0
  const cells: (IsoDate | null)[] = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (IsoDate | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
