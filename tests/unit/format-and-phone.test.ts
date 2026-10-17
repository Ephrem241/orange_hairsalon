import { describe, expect, it } from 'vitest'
import { formatDuration, formatEtb, formatPhone, whatsappHref } from '@/lib/format'
import { groupHours } from '@/lib/hours'
import { normalizePhone } from '@/lib/phone'

describe('ETB prices', () => {
  it('formats whole birr with grouping', () => {
    expect(formatEtb(1500)).toBe('ETB 1,500')
    expect(formatEtb(250000)).toBe('ETB 250,000')
    expect(formatEtb(0)).toBe('ETB 0')
  })

  it('marks variable pricing', () => {
    expect(formatEtb(4500, 'from')).toBe('From ETB 4,500')
  })

  it('rounds stray decimals rather than showing cents', () => {
    expect(formatEtb(1499.6)).toBe('ETB 1,500')
  })
})

describe('durations', () => {
  it.each([
    [45, '45 min'],
    [60, '1 hr'],
    [90, '1 hr 30 min'],
    [240, '4 hr'],
  ])('%i minutes → %s', (minutes, label) => {
    expect(formatDuration(minutes)).toBe(label)
  })
})

describe('Ethiopian phone numbers', () => {
  it.each([
    ['0912419748', '+251912419748'],
    ['0912 41 97 48', '+251912419748'],
    ['912419748', '+251912419748'],
    ['+251 91 241 9748', '+251912419748'],
    ['+251-912-419-748', '+251912419748'],
    ['251912419748', '+251912419748'],
    ['00251912419748', '+251912419748'],
    ['0712345678', '+251712345678'], // Safaricom Ethiopia
  ])('normalises %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it('accepts complete international numbers', () => {
    expect(normalizePhone('+1 202 555 0143')).toBe('+12025550143')
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958')
  })

  it.each(['', '12345', '0812345678', '+25191241974', '+2519124197481', 'call me', '+0912419748'])('rejects %j', (input) => {
    expect(normalizePhone(input)).toBeNull()
  })

  it('displays and links numbers', () => {
    expect(formatPhone('+251912419748')).toBe('+251 91 241 9748')
    expect(whatsappHref('+251912419748', 'Hello')).toBe('https://wa.me/251912419748?text=Hello')
  })
})

describe('opening hours', () => {
  it('groups identical consecutive days, Monday first', () => {
    const week = [
      { weekday: 0, isClosed: false, opensAt: '09:00', closesAt: '19:30' },
      ...[1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, isClosed: false, opensAt: '08:00', closesAt: '20:00' })),
    ]
    expect(groupHours(week)).toEqual([
      { days: 'Mon – Sat', hours: '8:00 AM – 8:00 PM' },
      { days: 'Sun', hours: '9:00 AM – 7:30 PM' },
    ])
  })

  it('shows closed days', () => {
    const week = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday, isClosed: weekday === 1, opensAt: '09:00', closesAt: '18:00',
    }))
    expect(groupHours(week)).toEqual([
      { days: 'Mon', hours: 'Closed' },
      { days: 'Tue – Sun', hours: '9:00 AM – 6:00 PM' },
    ])
  })
})
