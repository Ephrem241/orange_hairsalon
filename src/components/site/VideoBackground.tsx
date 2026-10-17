'use client'

import { getImageProps } from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import type { VideoAsset } from '@/config/media'
import { cn } from '@/lib/cn'
import { decidePlayback, readPlaybackEnvironment, type PlaybackDecision } from '@/lib/video-playback'

type Props = {
  asset: VideoAsset
  /** Above-the-fold hero: load the poster eagerly and the video straight away. */
  priority?: boolean
  className?: string
  /** Label for the pause control (WCAG 2.2.2: moving content must be pausable). */
  controlLabel?: string
  controlClassName?: string
}

/**
 * Full-bleed cinematic background: an optimised poster that is always present,
 * with a muted looping video faded in over it when the device and visitor
 * preferences allow. The video pauses when off screen or when the tab is
 * hidden, and non-priority videos are not even mounted until they approach
 * the viewport.
 */
export function VideoBackground({ asset, priority = false, className, controlLabel = 'background video', controlClassName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [decision, setDecision] = useState<PlaybackDecision | null>(null)
  const [nearViewport, setNearViewport] = useState(priority)
  // True once the video has actually started; it then stays visible (even paused).
  const [ready, setReady] = useState(false)
  const [userPaused, setUserPaused] = useState(false)

  // Decide once on mount, and again if the reduced-motion preference changes.
  useEffect(() => {
    const formats = {
      desktop: asset.sources.map((s) => s.type),
      mobile: asset.mobileSource?.type,
    }
    const evaluate = () => setDecision(decidePlayback(readPlaybackEnvironment(), formats))
    evaluate()
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    motionQuery.addEventListener('change', evaluate)
    return () => motionQuery.removeEventListener('change', evaluate)
  }, [asset])

  // Mount non-priority videos only when they come close to the viewport, then
  // keep them paused whenever they scroll out of view.
  const [inView, setInView] = useState(priority)
  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting)
        if (entry.isIntersecting) setNearViewport(true)
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const shouldRender = decision?.play === true && nearViewport

  useEffect(() => {
    const video = videoRef.current
    if (!video || !shouldRender) return
    const sync = () => {
      if (inView && !userPaused && document.visibilityState === 'visible') {
        video.play().catch(() => {
          // Autoplay refused (e.g. iOS Low Power Mode): the poster remains.
        })
      } else {
        video.pause()
      }
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [shouldRender, inView, userPaused])

  const common = { alt: '', sizes: '100vw' }
  const desktopPoster = getImageProps({
    ...common, src: asset.poster, width: asset.posterWidth, height: asset.posterHeight, quality: 75,
  }).props
  const mobilePoster = asset.mobilePoster
    ? getImageProps({ ...common, src: asset.mobilePoster, width: 718, height: 1280, quality: 75 }).props
    : null
  const { srcSet: desktopSrcSet, ...imgProps } = desktopPoster

  return (
    <div ref={containerRef} className={cn('absolute inset-0 overflow-hidden', className)}>
      <picture>
        {mobilePoster && <source media="(max-width: 767px)" srcSet={mobilePoster.srcSet} />}
        <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt="" (decorative) comes from getImageProps */}
        <img
          {...imgProps}
          fetchPriority={priority ? 'high' : 'auto'}
          loading={priority ? 'eager' : 'lazy'}
          className={cn('absolute inset-0 size-full object-cover', priority && 'animate-slow-zoom')}
        />
      </picture>

      {shouldRender && decision.play && (
        <video
          ref={videoRef}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-[1600ms] ease-[var(--ease-cinematic)]',
            ready ? 'opacity-100' : 'opacity-0',
          )}
          muted
          loop
          playsInline
          autoPlay
          preload={priority ? 'auto' : 'metadata'}
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden
          tabIndex={-1}
          onPlaying={() => setReady(true)}
          onError={() => setReady(false)}
        >
          {decision.variant === 'mobile' && asset.mobileSource ? (
            <source src={asset.mobileSource.src} type={asset.mobileSource.type} />
          ) : (
            asset.sources.map((s) => <source key={s.src} src={s.src} type={s.type} />)
          )}
        </video>
      )}

      {shouldRender && (
        <button
          type="button"
          onClick={() => setUserPaused((p) => !p)}
          aria-label={userPaused ? `Play ${controlLabel}` : `Pause ${controlLabel}`}
          className={cn(
            'absolute z-20 inline-flex size-10 items-center justify-center rounded-full border border-ivory/30',
            'bg-charcoal/40 text-ivory/80 backdrop-blur-sm transition-colors hover:border-gold hover:text-gold',
            controlClassName ?? 'bottom-6 right-6',
          )}
        >
          {userPaused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
        </button>
      )}
    </div>
  )
}
