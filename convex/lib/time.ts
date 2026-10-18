/**
 * Salon-local time for the Convex runtime.
 *
 * Africa/Addis_Ababa is UTC+3 all year (no daylight saving), so conversions use
 * a fixed offset rather than relying on the runtime's time-zone data. A unit
 * test cross-checks these against src/lib/time.ts, which goes through Intl.
 */
const SALON_OFFSET_MS = 3 * 60 * 60 * 1000
export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/** YYYY-MM-DD */
export type IsoDate = string

/** Salon-local date + "HH:MM" → epoch ms. */
export function localTs(date: IsoDate, hhmm: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = hhmm.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh, mm) - SALON_OFFSET_MS
}

/** Epoch ms → salon-local calendar date. */
export function localDate(ms: number): IsoDate {
  return new Date(ms + SALON_OFFSET_MS).toISOString().slice(0, 10)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const probe = new Date(Date.UTC(y, m - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
}

/** Calendar days from a to b (b − a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((localTs(b, '00:00') - localTs(a, '00:00')) / DAY)
}

export const iso = (ms: number) => new Date(ms).toISOString()
