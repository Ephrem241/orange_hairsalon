'use client'

import Image from 'next/image'
import { useId, useState } from 'react'
import { MoveHorizontal } from 'lucide-react'

/**
 * Compare slider for a genuine before/after pair from the same client. The
 * native range input keeps it keyboard and screen-reader accessible.
 */
export function BeforeAfter({ before, after, alt }: { before: string; after: string; alt: string }) {
  const [position, setPosition] = useState(50)
  const id = useId()
  return (
    <div className="relative aspect-[4/5] w-full select-none overflow-hidden rounded-sm bg-charcoal-700">
      <Image src={after} alt={`After: ${alt}`} fill sizes="(min-width: 1024px) 40vw, 90vw" className="object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <Image src={before} alt={`Before: ${alt}`} fill sizes="(min-width: 1024px) 40vw, 90vw" className="object-cover" />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-ivory/90" style={{ left: `${position}%` }}>
        <span className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ivory text-charcoal shadow-lg">
          <MoveHorizontal className="size-5" />
        </span>
      </div>
      <span className="eyebrow absolute top-4 left-4 rounded-sm bg-charcoal/70 px-2 py-1 text-[0.6rem] text-ivory">Before</span>
      <span className="eyebrow absolute top-4 right-4 rounded-sm bg-charcoal/70 px-2 py-1 text-[0.6rem] text-ivory">After</span>
      <label htmlFor={id} className="sr-only">
        Drag to compare before and after
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
    </div>
  )
}
