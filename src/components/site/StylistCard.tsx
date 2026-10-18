import Image from 'next/image'
import { initials } from '@/lib/format'
import type { Stylist } from '@/lib/types'
import { DemoBadge } from './DemoBadge'

export function StylistCard({ stylist }: { stylist: Stylist }) {
  return (
    <article className="group overflow-hidden rounded-sm border border-ivory/10 bg-charcoal-800">
      <div className="relative aspect-[4/5] overflow-hidden bg-charcoal-700">
        {stylist.photoPath ? (
          <Image
            src={stylist.photoPath}
            alt={`Portrait of ${stylist.displayName}`}
            fill
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-[1400ms] ease-[var(--ease-cinematic)] group-hover:scale-[1.05]"
          />
        ) : (
          <div aria-hidden className="absolute inset-0 flex items-center justify-center font-serif text-5xl text-gold/70">
            {initials(stylist.displayName)}
          </div>
        )}
        {stylist.isDemo && <DemoBadge className="absolute left-3 top-3" />}
      </div>
      <div className="p-5">
        <h3 className="font-serif text-lg text-ivory">{stylist.displayName}</h3>
        {stylist.title && <p className="mt-1 text-xs tracking-wide text-taupe">{stylist.title}</p>}
      </div>
    </article>
  )
}
