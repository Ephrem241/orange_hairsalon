import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {back && (
          <Link href={back.href} className="mb-2 inline-block text-sm text-taupe-700 hover:text-charcoal">
            ← {back.label}
          </Link>
        )}
        <h1 className="font-serif text-3xl text-charcoal">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-taupe-700">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn('rounded-md border border-charcoal/10 bg-white', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-charcoal/10 px-5 py-3.5">
          {title && <h2 className="text-sm font-semibold text-charcoal">{title}</h2>}
          {actions}
        </header>
      )}
      <div className={padded ? 'p-5' : undefined}>{children}</div>
    </section>
  )
}

export function StatCard({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'attention' }) {
  return (
    <div className={cn('rounded-md border bg-white p-5', tone === 'attention' ? 'border-amber-300 bg-amber-50/60' : 'border-charcoal/10')}>
      <p className="text-xs font-medium tracking-wide text-taupe-700 uppercase">{label}</p>
      <p className="mt-2 font-serif text-3xl text-charcoal tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-taupe-700">{hint}</p>}
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-charcoal/20 bg-white/60 px-6 py-12 text-center">
      <p className="font-serif text-xl text-charcoal">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-taupe-700">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-md border border-charcoal/10 bg-white', className)}>
      <table className="w-full min-w-[40rem] text-left text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('border-b border-charcoal/10 bg-ivory-200/60 px-4 py-2.5 text-xs font-semibold tracking-wide text-taupe-700 uppercase', className)}>{children}</th>
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('border-b border-charcoal/5 px-4 py-3 align-top', className)}>{children}</td>
}

export function NotPermitted() {
  return (
    <EmptyState title="Not available for your role">
      Ask the salon owner if you need access to this section.
    </EmptyState>
  )
}

export function AdminButtonLink({ href, children, variant = 'dark' }: { href: string; children: ReactNode; variant?: 'dark' | 'outline' }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-sm px-4 text-sm font-medium transition-colors',
        variant === 'dark' ? 'bg-charcoal text-ivory hover:bg-charcoal-700' : 'border border-charcoal/20 bg-white text-charcoal hover:border-charcoal/50',
      )}
    >
      {children}
    </Link>
  )
}
