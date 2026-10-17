import { describe, expect, it } from 'vitest'
import { addDays, formatTime, formatTime24, isIsoDate, monthGrid, salonDate, salonInstant, weekdayOf } from '@/lib/time'
import { decidePlayback, type PlaybackEnvironment } from '@/lib/video-playback'

describe('salon time (Africa/Addis_Ababa)', () => {
  it('converts salon wall-clock time to the correct UTC instant', () => {
    expect(salonInstant('2026-10-19', '08:00')).toBe('2026-10-19T05:00:00.000Z')
    expect(salonInstant('2026-12-31', '23:30')).toBe('2026-12-31T20:30:00.000Z')
  })

  it('reads the salon-local date of an instant, across midnight UTC', () => {
    expect(salonDate('2026-10-19T21:30:00.000Z')).toBe('2026-10-20') // 00:30 next day in Addis
    expect(salonDate('2026-10-19T20:59:00.000Z')).toBe('2026-10-19')
  })

  it('formats instants in salon time regardless of the machine time zone', () => {
    expect(formatTime24('2026-10-19T05:00:00.000Z')).toBe('08:00')
    expect(formatTime('2026-10-19T11:30:00.000Z')).toBe('2:30 PM')
  })

  it('does calendar arithmetic without time-zone drift', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
    expect(weekdayOf('2026-10-19')).toBe(1) // Monday
  })

  it('validates ISO dates strictly', () => {
    expect(isIsoDate('2026-10-19')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('19/10/2026')).toBe(false)
    expect(isIsoDate(undefined)).toBe(false)
  })

  it('builds Monday-first month grids', () => {
    const weeks = monthGrid(2026, 9) // October 2026 starts on a Thursday
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
    expect(weeks.flat().filter(Boolean)).toHaveLength(31)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })
})

describe('background video playback decision', () => {
  const base: PlaybackEnvironment = {
    prefersReducedMotion: false,
    saveData: false,
    effectiveType: '4g',
    viewportWidth: 1440,
    canPlay: () => true,
  }
  const formats = { desktop: ['video/webm', 'video/mp4'], mobile: 'video/mp4' }

  it('plays the desktop film on capable devices', () => {
    expect(decidePlayback(base, formats)).toEqual({ play: true, variant: 'desktop' })
  })

  it('uses the lighter portrait cut on phones', () => {
    expect(decidePlayback({ ...base, viewportWidth: 390 }, formats)).toEqual({ play: true, variant: 'mobile' })
  })

  it('respects reduced motion — poster only', () => {
    expect(decidePlayback({ ...base, prefersReducedMotion: true }, formats)).toEqual({ play: false, reason: 'reduced-motion' })
  })

  it('saves bandwidth on Save-Data and 2G', () => {
    expect(decidePlayback({ ...base, saveData: true }, formats)).toMatchObject({ play: false, reason: 'save-data' })
    expect(decidePlayback({ ...base, effectiveType: '2g' }, formats)).toMatchObject({ play: false, reason: 'slow-network' })
  })

  it('falls back to the poster when no format is playable', () => {
    expect(decidePlayback({ ...base, canPlay: () => false }, formats)).toEqual({ play: false, reason: 'unsupported' })
  })

  it('falls back to a desktop source on phones when the mobile cut is unplayable', () => {
    const env = { ...base, viewportWidth: 390, canPlay: (t: string) => t === 'video/webm' }
    expect(decidePlayback(env, formats)).toEqual({ play: true, variant: 'desktop' })
  })
})
