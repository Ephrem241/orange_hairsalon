'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Slow, subtle entrance as a section scrolls into view. Content is fully
 * visible without JavaScript (the hidden state only applies under `html.js`),
 * and reduced-motion users see it immediately.
 */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} data-reveal={shown ? 'in' : 'out'} style={{ transitionDelay: `${delay}ms` }} className={cn('reveal', className)}>
      {children}
    </div>
  )
}
