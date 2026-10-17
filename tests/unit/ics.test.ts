import { describe, expect, it } from 'vitest'
import { buildIcs } from '@/lib/ics'

describe('add-to-calendar file', () => {
  it('produces a valid UTC event with escaped text', () => {
    const ics = buildIcs({
      uid: 'OS-7K4M2P@orange-salon',
      start: '2026-10-19T05:00:00.000Z',
      end: '2026-10-19T06:30:00.000Z',
      summary: 'Silk press, wash; style — Orange Salon',
      location: 'Orange Salon, Ednamoll Street, Addis Ababa',
      now: new Date('2026-10-16T12:00:00.000Z'),
    })
    const lines = ics.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('DTSTART:20261019T050000Z')
    expect(lines).toContain('DTEND:20261019T063000Z')
    expect(lines).toContain('DTSTAMP:20261016T120000Z')
    expect(lines).toContain('SUMMARY:Silk press\\, wash\\; style — Orange Salon')
    expect(lines).toContain('LOCATION:Orange Salon\\, Ednamoll Street\\, Addis Ababa')
    expect(lines.at(-1)).toBe('END:VCALENDAR')
  })
})
