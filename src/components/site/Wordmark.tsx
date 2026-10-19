import { cn } from '@/lib/cn'

/** Typographic wordmark: Orange over a widely tracked SALON, as in the brand campaign. */
export function Wordmark({ tone = 'light', className }: { tone?: 'light' | 'dark'; className?: string }) {
  return (
    <span className={cn('inline-flex flex-col items-center leading-none select-none', className)}>
      <span
        className={cn(
          'font-serif text-[1.6rem] tracking-[0.06em] md:text-[1.85rem]',
          tone === 'light' ? 'text-gold' : 'text-gold-700',
        )}
      >
        Orange
      </span>
      <span
        className={cn(
          'mt-1 pl-[0.55em] font-sans text-[0.55rem] font-medium tracking-[0.55em]',
          tone === 'light' ? 'text-ivory/80' : 'text-charcoal/70',
        )}
      >
        SALON
      </span>
    </span>
  )
}
