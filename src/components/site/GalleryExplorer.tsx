'use client'

import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react'
import { galleryCategoryLabel } from '@/lib/gallery'
import type { GalleryItem } from '@/lib/types'
import { BeforeAfter } from './BeforeAfter'
import { FilterChip } from './ServicesExplorer'

export function GalleryExplorer({ items }: { items: GalleryItem[] }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const categories = [...new Set(items.map((i) => i.category))]
  const requested = params.get('category')
  const active = requested && categories.includes(requested) ? requested : null
  const visible = active ? items.filter((i) => i.category === active) : items
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const select = (category: string | null) => {
    setOpenIndex(null)
    router.replace(category ? `${pathname}?category=${category}` : pathname, { scroll: false })
  }

  return (
    <>
      {categories.length > 1 && (
        <div role="group" aria-label="Filter by style" className="-mx-1 flex flex-wrap gap-2">
          <FilterChip tone="light" active={!active} onClick={() => select(null)}>
            All work
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c} tone="light" active={active === c} onClick={() => select(c)}>
              {galleryCategoryLabel(c)}
            </FilterChip>
          ))}
        </div>
      )}

      <ul className="mt-10 columns-2 gap-3 md:columns-3 md:gap-5 xl:columns-4" aria-live="polite">
        {visible.map((item, index) => (
          <li key={item.id} className="mb-3 break-inside-avoid md:mb-5">
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              className="group relative block w-full overflow-hidden rounded-sm bg-charcoal-700 text-left"
              aria-label={`Open ${item.caption ?? item.altText}`}
            >
              <Image
                src={(item.mediaType === 'video' ? item.posterPath! : item.mediaPath)}
                alt={item.altText}
                width={item.width ?? 1000}
                height={item.height ?? 1250}
                sizes="(min-width: 1280px) 23vw, (min-width: 768px) 31vw, 48vw"
                className="h-auto w-full transition-transform duration-[1400ms] ease-[var(--ease-cinematic)] group-hover:scale-[1.04]"
              />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              {item.caption && (
                <span className="absolute inset-x-0 bottom-0 translate-y-2 p-4 text-sm text-ivory opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  {item.caption}
                </span>
              )}
              <span className="absolute top-3 left-3 flex gap-1.5">
                {item.mediaType === 'video' && (
                  <span className="flex size-8 items-center justify-center rounded-full bg-charcoal/70 text-ivory">
                    <Play aria-hidden className="ml-0.5 size-3.5 fill-current" />
                    <span className="sr-only">Video</span>
                  </span>
                )}
                {item.beforePath && <Badge>Before &amp; after</Badge>}
                {item.source === 'illustrative' && <Badge>Illustrative</Badge>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Lightbox items={visible} index={openIndex} onChange={setOpenIndex} />
    </>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-charcoal/75 px-2 py-1 text-[0.625rem] font-medium tracking-[0.14em] text-ivory uppercase">
      {children}
    </span>
  )
}

function Lightbox({ items, index, onChange }: { items: GalleryItem[]; index: number | null; onChange: (i: number | null) => void }) {
  const reduceMotion = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const touchStart = useRef<number | null>(null)
  const item = index === null ? null : items[index]

  const close = useCallback(() => onChange(null), [onChange])
  const step = useCallback(
    (delta: number) => {
      if (index === null) return
      onChange((index + delta + items.length) % items.length)
    },
    [index, items.length, onChange],
  )

  useEffect(() => {
    if (index === null) return
    returnFocus.current ??= document.activeElement as HTMLElement
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'Tab') {
        // Keep focus inside the viewer.
        const focusables = Array.from(document.querySelectorAll<HTMLElement>('[data-lightbox] button, [data-lightbox] video, [data-lightbox] input'))
        const first = focusables[0]
        const last = focusables.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [index, close, step])

  // Restore focus to the thumbnail when the viewer closes.
  useEffect(() => {
    if (index === null && returnFocus.current) {
      returnFocus.current.focus()
      returnFocus.current = null
    }
  }, [index])

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key="lightbox"
          data-lightbox
          role="dialog"
          aria-modal="true"
          aria-label={item.caption ?? 'Gallery image'}
          className="fixed inset-0 z-[70] flex flex-col bg-charcoal/95"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchStart.current === null) return
            const dx = e.changedTouches[0].clientX - touchStart.current
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1)
            touchStart.current = null
          }}
        >
          <div className="flex items-center justify-between px-5 py-4 text-ivory/70">
            <span className="text-sm tabular-nums">
              {index! + 1} / {items.length}
            </span>
            <button ref={closeRef} type="button" onClick={close} aria-label="Close viewer" className="inline-flex size-11 items-center justify-center rounded-full hover:text-gold">
              <X aria-hidden className="size-6" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 md:px-20">
            <AnimatePresence mode="wait">
              <motion.figure
                key={item.id}
                className="flex h-full max-h-full w-full flex-col items-center justify-center"
                initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
                  {item.mediaType === 'video' ? (
                    <video
                      key={item.mediaPath}
                      src={item.mediaPath}
                      poster={item.posterPath ? item.posterPath : undefined}
                      controls
                      autoPlay
                      muted
                      playsInline
                      loop
                      className="max-h-full max-w-full rounded-sm"
                      aria-label={item.altText}
                    />
                  ) : item.beforePath ? (
                    <div className="w-full max-w-md">
                      <BeforeAfter before={item.beforePath} after={item.mediaPath} alt={item.altText} />
                    </div>
                  ) : (
                    <Image
                      src={item.mediaPath}
                      alt={item.altText}
                      fill
                      sizes="100vw"
                      quality={85}
                      className="object-contain"
                    />
                  )}
                </div>
                {(item.caption || item.source === 'illustrative') && (
                  <figcaption className="py-5 text-center text-sm text-ivory/80">
                    {item.caption}
                    {item.source === 'illustrative' && (
                      <span className="mt-1 block text-xs text-taupe">Illustrative image — not Orange Salon client work</span>
                    )}
                  </figcaption>
                )}
              </motion.figure>
            </AnimatePresence>

            {items.length > 1 && (
              <>
                <button type="button" onClick={() => step(-1)} aria-label="Previous" className="absolute top-1/2 left-2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-ivory/20 text-ivory/80 hover:border-gold hover:text-gold md:flex">
                  <ChevronLeft aria-hidden className="size-6" />
                </button>
                <button type="button" onClick={() => step(1)} aria-label="Next" className="absolute top-1/2 right-2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-ivory/20 text-ivory/80 hover:border-gold hover:text-gold md:flex">
                  <ChevronRight aria-hidden className="size-6" />
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
