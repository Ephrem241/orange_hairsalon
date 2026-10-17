/**
 * Decides whether a decorative background video should play at all, and which
 * source to use. Kept free of DOM access so it can be unit tested.
 *
 * The poster image is always rendered; the video is an enhancement layered on
 * top that is skipped entirely (no bytes downloaded) when:
 *   - the visitor prefers reduced motion,
 *   - the browser asks to save data, or the connection is 2G,
 *   - the browser cannot play any provided format.
 */
export type PlaybackEnvironment = {
  prefersReducedMotion: boolean
  saveData: boolean
  effectiveType?: string
  viewportWidth: number
  canPlay: (mimeType: string) => boolean
}

export type PlaybackDecision =
  | { play: false; reason: 'reduced-motion' | 'save-data' | 'slow-network' | 'unsupported' }
  | { play: true; variant: 'mobile' | 'desktop' }

export const MOBILE_BREAKPOINT = 768

export function decidePlayback(
  env: PlaybackEnvironment,
  formats: { desktop: string[]; mobile?: string },
): PlaybackDecision {
  if (env.prefersReducedMotion) return { play: false, reason: 'reduced-motion' }
  if (env.saveData) return { play: false, reason: 'save-data' }
  if (env.effectiveType === 'slow-2g' || env.effectiveType === '2g') return { play: false, reason: 'slow-network' }

  const narrow = env.viewportWidth < MOBILE_BREAKPOINT
  if (narrow && formats.mobile && env.canPlay(formats.mobile)) return { play: true, variant: 'mobile' }
  if (formats.desktop.some((type) => env.canPlay(type))) return { play: true, variant: 'desktop' }
  return { play: false, reason: 'unsupported' }
}

/** Read the live browser environment (client only). */
export function readPlaybackEnvironment(): PlaybackEnvironment {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const probe = document.createElement('video')
  return {
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: Boolean(connection?.saveData),
    effectiveType: connection?.effectiveType,
    viewportWidth: window.innerWidth,
    canPlay: (type) => probe.canPlayType(type) !== '',
  }
}
