import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  tone = 'dark',
  align = 'left',
  as: Heading = 'h2',
  className,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** `dark` = dark text for ivory sections; `light` = light text on charcoal. */
  tone?: 'dark' | 'light'
  align?: 'left' | 'center'
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        align === 'center' && 'items-center text-center md:flex-col md:items-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow && <p className={cn('eyebrow mb-4', tone === 'dark' ? 'text-gold-700' : 'text-gold')}>{eyebrow}</p>}
        <Heading
          className={cn('display text-4xl md:text-5xl', tone === 'dark' ? 'text-charcoal' : 'text-ivory')}
        >
          {title}
        </Heading>
        {description && (
          <div className={cn('mt-5 max-w-xl text-[0.95rem] leading-relaxed', tone === 'dark' ? 'text-taupe-700' : 'text-ivory/70')}>
            {description}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
