#!/usr/bin/env node
/**
 * One-off media pipeline: turns the raw salon assets in ./images into web-ready
 * files under ./public. Requires ffmpeg on PATH. Outputs are committed, so this
 * only needs re-running when source footage or photos change.
 *
 *   node scripts/process-media.mjs            # process everything
 *   node scripts/process-media.mjs --only=hero
 *
 * To replace the hero film, drop the new master at images/hero.mp4 and re-run
 * with --only=hero (see docs/MEDIA.md).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = (name) => join(root, 'images', name)
const out = (path) => join(root, 'public', path)

const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' })
}

function report(path) {
  const kb = Math.round(statSync(path).size / 1024)
  console.log(`  ${path.replace(root, '.')}  ${kb} KB`)
}

/** Shared H.264 settings: no audio, web-optimised, broad device support. */
const h264 = (crf) => [
  '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
  '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
]
/** `maxBitrate` switches VP9 from pure CRF to constrained quality (CRF with a ceiling). */
const vp9 = (crf, maxBitrate = '0') => [
  '-an', '-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', maxBitrate,
  '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p',
]

/** Subtle film grade: lift contrast slightly, warm the mids, ease saturation. */
const GRADE = 'eq=contrast=1.06:saturation=0.92,colorbalance=rm=0.04:gm=0.0:bm=-0.04'

const videoJobs = {
  hero() {
    const input = src('hero.mp4')
    const base = out('videos/orange-salon-hero')
    mkdirSync(dirname(base), { recursive: true })
    ffmpeg(['-i', input, '-vf', `scale=1280:-2,${GRADE}`, '-r', '24', ...h264(25), `${base}.mp4`])
    ffmpeg(['-i', input, '-vf', `scale=1280:-2,${GRADE}`, '-r', '24', ...vp9(36), `${base}.webm`])
    // Whole frame at 480p for phones, which show the hero film uncropped.
    ffmpeg(['-i', input, '-vf', `scale=854:-2,${GRADE}`, '-r', '24', ...h264(27), `${base}-mobile.mp4`])
    mkdirSync(out('images/hero'), { recursive: true })
    ffmpeg(['-i', input, '-vf', `scale=1600:-2,${GRADE}`, '-frames:v', '1', '-q:v', '3', out('images/hero/hero-poster.jpg')])
    for (const f of [`${base}.mp4`, `${base}.webm`, `${base}-mobile.mp4`, out('images/hero/hero-poster.jpg')]) report(f)
  },

  // Braid flip (HEVC master, unplayable in several browsers) → ambient CTA band.
  // The master is portrait (1080×2400 after rotation); the band is a wide strip,
  // so crop a 16:9 window through the moving braid lengths. The footage is grainy
  // and sits under a dark overlay: denoise and cap the bitrate (~1 MB per file).
  ambient() {
    const input = src('hair style 9.mp4')
    const base = out('videos/braids-in-motion')
    const crop = 'crop=iw:iw*9/16:0:ih*0.5'
    // Warm sepia duotone: the braids read as gold texture and the bright shirt
    // behind them drops into brown, matching the charcoal/orange-gold palette.
    const duotone = 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,eq=contrast=1.15:brightness=-0.06'
    const vf = `${crop},hqdn3d=4:3:6:4,scale=1024:-2,${duotone}`
    const cap = ['-maxrate', '900k', '-bufsize', '1800k']
    ffmpeg(['-i', input, '-t', '10', '-vf', vf, '-r', '24', ...h264(28), ...cap, `${base}.mp4`])
    ffmpeg(['-i', input, '-t', '10', '-vf', vf, '-r', '24', ...vp9(40, '800k'), `${base}.webm`])
    ffmpeg(['-i', input, '-vf', vf, '-frames:v', '1', '-q:v', '6', `${base}-poster.jpg`])
    for (const f of [`${base}.mp4`, `${base}.webm`, `${base}-poster.jpg`]) report(f)
  },

  // Portrait reels of genuine salon work for the gallery (click to play).
  reels() {
    const reels = [
      ['hair style 1.mp4', 'cornrows-with-natural-volume'],
      ['hair style 2.mp4', 'copper-bob-colour'],
      ['hair style 3.mp4', 'knotless-braids-two-tone'],
    ]
    mkdirSync(out('videos/gallery'), { recursive: true })
    for (const [file, name] of reels) {
      const base = out(`videos/gallery/${name}`)
      ffmpeg(['-i', src(file), '-vf', 'scale=-2:960', '-r', '30', ...h264(26), `${base}.mp4`])
      ffmpeg(['-ss', '1', '-i', src(file), '-vf', 'scale=-2:1280', '-frames:v', '1', '-q:v', '3', `${base}-poster.jpg`])
      report(`${base}.mp4`)
      report(`${base}-poster.jpg`)
    }
  },
}

const photoJobs = {
  photos() {
    const photos = [
      ['hair style 4.png', 'stylist-at-work'],
      ['hair style 5.png', 'two-strand-twists'],
      ['hair style 6.png', 'blonde-spiral-curls'],
      ['hair style7.png', 'balayage-waves'],
      ['hair style 8.jpg', 'stitch-braids-curly-ponytail'],
      ['hair style 10.png', 'copper-passion-twists'],
      ['hair style 11.jpg', 'burgundy-waves-highlights'],
      ['hair style 12.jpg', 'burgundy-waves-neon-sign'],
    ]
    mkdirSync(out('images/gallery'), { recursive: true })
    for (const [file, name] of photos) {
      const target = out(`images/gallery/${name}.jpg`)
      // Cap the long edge at 2000px; next/image serves AVIF/WebP variants from these.
      ffmpeg(['-i', src(file), '-vf', "scale='if(gt(iw,ih),min(2000,iw),-2)':'if(gt(iw,ih),-2,min(2000,ih))'", '-q:v', '3', target])
      report(target)
    }
  },

  brand() {
    mkdirSync(out('images/brand'), { recursive: true })
    ffmpeg(['-i', src('orange salon logo.jpg'), '-q:v', '2', out('images/brand/orange-salon-logo.jpg')])
    report(out('images/brand/orange-salon-logo.jpg'))
  },
}

const jobs = { ...videoJobs, ...photoJobs }
for (const [name, run] of Object.entries(jobs)) {
  if (only && only !== name) continue
  console.log(`▸ ${name}`)
  run()
}
