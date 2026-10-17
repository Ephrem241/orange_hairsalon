import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'outline-light' | 'outline-dark' | 'ghost-light' | 'ghost-dark' | 'dark'
type Size = 'sm' | 'md' | 'lg'

const base =
  'group inline-flex items-center justify-center gap-2.5 rounded-sm font-sans font-medium tracking-wide whitespace-nowrap ' +
  'transition-[background-color,color,border-color,box-shadow] duration-500 ease-[var(--ease-cinematic)] ' +
  'disabled:pointer-events-none disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-gold text-charcoal hover:bg-gold-400 shadow-[0_10px_30px_-12px_rgba(201,133,69,0.7)]',
  'outline-light': 'border border-ivory/60 text-ivory hover:border-ivory hover:bg-ivory hover:text-charcoal',
  'outline-dark': 'border border-charcoal/70 text-charcoal hover:bg-charcoal hover:text-ivory',
  'ghost-light': 'text-ivory/85 hover:text-gold',
  'ghost-dark': 'text-charcoal hover:text-gold-700',
  dark: 'bg-charcoal text-ivory hover:bg-charcoal-700',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-[0.8125rem]',
  md: 'h-11 px-6 text-sm',
  lg: 'h-13 px-8 text-[0.9375rem]',
}

type CommonProps = { variant?: Variant; size?: Size; arrow?: boolean; children: ReactNode; className?: string }

function Content({ arrow, children }: { arrow?: boolean; children: ReactNode }) {
  return (
    <>
      {children}
      {arrow && (
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform duration-500 ease-[var(--ease-cinematic)] group-hover:translate-x-1"
        />
      )}
    </>
  )
}

export function ButtonLink({
  variant = 'primary', size = 'md', arrow, className, children, ...props
}: CommonProps & Omit<ComponentProps<typeof Link>, 'className' | 'children'>) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...props}>
      <Content arrow={arrow}>{children}</Content>
    </Link>
  )
}

export function Button({
  variant = 'primary', size = 'md', arrow, className, children, type = 'button', ...props
}: CommonProps & Omit<ComponentProps<'button'>, 'className' | 'children'>) {
  return (
    <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      <Content arrow={arrow}>{children}</Content>
    </button>
  )
}

/** External link styled as a button (tel:, wa.me, maps). */
export function ButtonAnchor({
  variant = 'primary', size = 'md', arrow, className, children, ...props
}: CommonProps & Omit<ComponentProps<'a'>, 'className' | 'children'>) {
  return (
    <a className={cn(base, variants[variant], sizes[size], className)} {...props}>
      <Content arrow={arrow}>{children}</Content>
    </a>
  )
}
