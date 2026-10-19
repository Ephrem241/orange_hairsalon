# Media: hero film, video and photography

Source files live in `images/` and are never served directly. `scripts/process-media.mjs` (ffmpeg) turns them into web-ready files under `public/`. These output files are committed.

| Output | Source | Notes |
|---|---|---|
| `public/videos/orange-salon-hero.{webm,mp4}` | `images/hero.mp4` | 1280px, 24 fps, no audio, light film grade, ~1 MB each |
| `public/videos/orange-salon-hero-mobile.mp4` | same | Whole frame at 480p for phones |
| `public/images/hero/hero-poster.jpg` | first frame | Shown instantly; the film fades in over it |
| `public/videos/braids-in-motion.{webm,mp4}` + poster | `images/hair style 9.mp4` | Warm duotone strip behind the booking CTA (the master is HEVC, which several browsers can't play) |
| `public/videos/gallery/*.mp4` + posters | `hair style 1–3.mp4` | Real client reels for the gallery |
| `public/images/gallery/*.jpg` | `hair style 4–12` | Real salon photography, at most 2000px |

## Replacing the hero film

1. Export the new master as MP4 (H.264 or HEVC), 16:9, at least 1280×720, 8–15 seconds, and seamlessly loopable if possible. Sound is removed.
2. Save it as `images/hero.mp4`.
3. Run `npm run media -- --only=hero`.
4. Check the poster frame, `public/images/hero/hero-poster.jpg`. It is the first frame, so start the edit on a strong image.
5. If the poster's dimensions change, update `src/config/media.ts`.

The paths the site uses are set in `src/config/media.ts`.

## How the video behaves

- **Always present:**
  - The optimised poster (AVIF or WebP through `next/image`) renders first.
  - The film then fades in once it's actually playing.
- **No video is downloaded when:**
  - the visitor prefers reduced motion;
  - the browser has Save-Data on;
  - the connection is 2G;
  - the browser can't play the format.
- **Fallback:** if autoplay is refused (for example in iOS Low Power Mode), the poster stays.
- **Pausing:**
  - Videos pause when scrolled out of view or when the tab is hidden.
  - Every video has a visible pause button (WCAG 2.2.2).
- **Loading:** the CTA video isn't loaded until it approaches the viewport, so two heavy videos never autoplay at once.

## About the current footage

- **`hero.mp4`** appears to be a stylised, AI-assisted film generated from the salon's own photographs.
  - It is used as ambient imagery only, never captioned as client work.
  - Confirm its origin and usage rights, or replace it with filmed salon footage.
- **Gallery images** are genuine salon work.
  - Confirm that clients whose faces are visible (`hair style 4`, `11`, `12` and reel 1) have consented to appearing on the website.
