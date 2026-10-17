'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'
import type { Service, ServiceCategory } from '@/lib/types'
import { ServiceCard } from './ServiceCard'

/** Category filter for the services page; the choice lives in the URL so it can be shared. */
export function ServicesExplorer({ services, categories }: { services: Service[]; categories: ServiceCategory[] }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const used = categories.filter((c) => services.some((s) => s.category?.id === c.id))
  const active = used.some((c) => c.slug === params.get('category')) ? params.get('category') : null
  const visible = active ? services.filter((s) => s.category?.slug === active) : services

  const select = (slug: string | null) => {
    const next = new URLSearchParams(params)
    if (slug) next.set('category', slug)
    else next.delete('category')
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false })
  }

  return (
    <div>
      {used.length > 1 && (
        <div role="group" aria-label="Filter by category" className="-mx-1 flex flex-wrap gap-2">
          <FilterChip active={!active} onClick={() => select(null)}>
            All services
          </FilterChip>
          {used.map((category) => (
            <FilterChip key={category.id} active={active === category.slug} onClick={() => select(category.slug)}>
              {category.name}
            </FilterChip>
          ))}
        </div>
      )}
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {visible.map((service) => (
          <li key={service.id}>
            <ServiceCard service={service} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function FilterChip({
  active, onClick, children, tone = 'dark',
}: { active: boolean; onClick: () => void; children: React.ReactNode; tone?: 'dark' | 'light' }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'mx-1 rounded-full border px-4 py-2 text-[0.8125rem] tracking-wide transition-colors duration-300',
        tone === 'dark'
          ? active
            ? 'border-charcoal bg-charcoal text-ivory'
            : 'border-charcoal/20 text-charcoal hover:border-charcoal/60'
          : active
            ? 'border-gold bg-gold text-charcoal'
            : 'border-ivory/25 text-ivory/80 hover:border-ivory/60',
      )}
    >
      {children}
    </button>
  )
}
