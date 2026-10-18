import { describe, expect, it } from 'vitest'
import { checkSlot, dayIsOpen, freeSlots, type StylistDay } from '@convex/lib/availability'
import { addDays, localDate, localTs, weekdayOf } from '@convex/lib/time'
import { salonDate, salonInstant } from '@/lib/time'

const date = '2026-10-19' // a Monday
const at = (hhmm: string) => localTs(date, hhmm)

const day = (overrides: Partial<StylistDay> = {}): StylistDay => ({
  date,
  hours: { isClosed: false, opensAt: '08:00', closesAt: '20:00' },
  shifts: [{ startsAt: '08:00', endsAt: '17:00' }],
  breaks: [{ startsAt: '12:00', endsAt: '13:00' }],
  timeOff: [],
  busy: [],
  ...overrides,
})

describe('salon time (fixed UTC+3)', () => {
  it('matches the Intl-based helpers used by the website', () => {
    for (const d of ['2026-01-01', '2026-03-29', '2026-06-21', '2026-10-25', '2026-12-31']) {
      for (const t of ['00:00', '02:59', '03:00', '12:30', '23:59']) {
        expect(new Date(localTs(d, t)).toISOString()).toBe(salonInstant(d, t))
        expect(localDate(localTs(d, t))).toBe(salonDate(salonInstant(d, t)))
      }
    }
    expect(weekdayOf(date)).toBe(1)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('availability rules', () => {
  it('explains why a time is unavailable', () => {
    expect(checkSlot(day(), at('07:30'), 60, 15)).toBe('OUTSIDE_HOURS')
    expect(checkSlot(day(), at('16:30'), 60, 15)).toBe('OUTSIDE_HOURS')
    expect(checkSlot(day(), at('11:30'), 60, 15)).toBe('ON_BREAK')
    expect(checkSlot(day({ timeOff: [{ start: at('09:00'), end: at('10:00') }] }), at('08:00'), 60, 15)).toBe('TIME_OFF') // buffer runs into it
    expect(checkSlot(day({ busy: [{ id: 'a', start: at('09:00'), end: at('10:15') }] }), at('08:30'), 60, 0)).toBe('OVERLAP')
    expect(checkSlot(day({ busy: [{ id: 'a', start: at('09:00'), end: at('10:15') }] }), at('08:30'), 60, 0, 'a')).toBeNull()
    expect(checkSlot(day(), at('11:00'), 60, 15)).toBeNull() // the buffer may run into lunch; the service may not
  })

  it('clips shifts to opening hours and closes on closed days', () => {
    const early = day({ shifts: [{ startsAt: '06:00', endsAt: '09:00' }], breaks: [] })
    expect(freeSlots(early, 60, 0, 30).map((t) => (t - at('00:00')) / 60_000)).toEqual([8 * 60])
    expect(freeSlots(day({ hours: { isClosed: true } }), 60, 0, 15)).toEqual([])
    expect(freeSlots(day({ hours: null }), 60, 0, 15)).toEqual([])
  })

  it('treats a day as open unless every window is fully covered by one time-off period', () => {
    expect(dayIsOpen(day())).toBe(true)
    expect(dayIsOpen(day({ timeOff: [{ start: at('08:00'), end: at('12:00') }] }))).toBe(true)
    expect(dayIsOpen(day({ timeOff: [{ start: at('00:00'), end: at('23:59') }] }))).toBe(false)
  })
})
