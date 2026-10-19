/**
 * Cinematic media used by the public site. To replace the hero film, follow
 * docs/MEDIA.md: drop the new master at images/hero.mp4 and run
 * `node scripts/process-media.mjs --only=hero`, which regenerates every file
 * referenced below. Paths are relative to /public.
 */
export type VideoAsset = {
  /** Sources in preference order; the browser plays the first it supports. */
  sources: { src: string; type: string }[]
  /** Lighter source for narrow screens (optional). */
  mobileSource?: { src: string; type: string }
  poster: string
  mobilePoster?: string
  posterWidth: number
  posterHeight: number
}

export const heroFilm: VideoAsset = {
  sources: [
    { src: '/videos/orange-salon-hero.webm', type: 'video/webm' },
    { src: '/videos/orange-salon-hero.mp4', type: 'video/mp4' },
  ],
  mobileSource: { src: '/videos/orange-salon-hero-mobile.mp4', type: 'video/mp4' },
  poster: '/images/hero/hero-poster.jpg',
  posterWidth: 1600,
  posterHeight: 900,
}

/** Ambient braid movement behind the booking call to action. */
export const ambientFilm: VideoAsset = {
  sources: [
    { src: '/videos/braids-in-motion.webm', type: 'video/webm' },
    { src: '/videos/braids-in-motion.mp4', type: 'video/mp4' },
  ],
  poster: '/videos/braids-in-motion-poster.jpg',
  posterWidth: 1024,
  posterHeight: 576,
}

/** Real interior / at-work photograph used for the About composition. */
export const aboutPhoto = {
  src: '/images/gallery/stylist-at-work.jpg',
  width: 1510,
  height: 1536,
  alt: 'A stylist at work with a client inside Orange Salon',
}

export const neonSignPhoto = {
  src: '/images/gallery/burgundy-waves-neon-sign.jpg',
  width: 960,
  height: 1600,
  alt: 'A client with burgundy waves in front of the illuminated Orange Salon sign',
}
