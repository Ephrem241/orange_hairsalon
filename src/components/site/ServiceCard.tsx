import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'
import { formatDuration, formatEtb } from '@/lib/format'
import type { Service } from '@/lib/types'
import { DemoBadge } from './DemoBadge'

export function ServiceCard({ service, sizes = '(min-width: 1280px) 22vw, (min-width: 768px) 45vw, 90vw' }: { service: Service; sizes?: string }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-sm bg-white shadow-[0_1px_0_rgba(23,21,19,0.06),0_18px_40px_-28px_rgba(23,21,19,0.45)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-ivory-300">
        {service.imagePath ? (
          <Image
            src={service.imagePath}
            alt=""
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-[1400ms] ease-[var(--ease-cinematic)] group-hover:scale-[1.06]"
          />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_#e6dacb,_#c9b9a6)]" />
        )}
        {service.isDemo && <DemoBadge className="absolute left-3 top-3" />}
      </div>
      <div className="flex flex-1 flex-col p-6">
        {service.category && <p className="eyebrow text-[0.625rem] text-gold-700">{service.category.name}</p>}
        <h3 className="mt-2 font-serif text-xl text-charcoal">
          <Link href={`/services/${service.slug}`} className="after:absolute after:inset-0">
            {service.name}
          </Link>
        </h3>
        {service.summary && <p className="mt-2 text-sm leading-relaxed text-taupe-700">{service.summary}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-6">
          <div className="text-sm">
            <p className="font-medium text-charcoal">{formatEtb(service.priceEtb, service.priceType)}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-taupe-700">
              <Clock aria-hidden className="size-3.5" /> {formatDuration(service.durationMin)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-gold-700">
            Learn more
            <ArrowRight aria-hidden className="size-3.5 transition-transform duration-500 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </article>
  )
}
