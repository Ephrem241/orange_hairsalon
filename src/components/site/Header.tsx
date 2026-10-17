'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Menu, Phone, X } from 'lucide-react'
import { mainNav } from '@/config/site'
import { cn } from '@/lib/cn'
import { formatPhone, telHref } from '@/lib/format'
import { ButtonLink } from '@/components/ui/Button'
import { Wordmark } from './Wordmark'

function isActive(pathname: string | null, href: string) {
  if (!pathname || href.includes('#')) return false
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

type NavProps = { variant: 'desktop' | 'mobile'; pathname: string | null; animate?: boolean; onNavigate?: () => void }

function NavLinks({ variant, pathname, animate, onNavigate }: NavProps) {
  if (variant === 'desktop') {
    return (
      <ul className="flex items-center gap-9">
        {mainNav.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative py-2 text-[0.8125rem] tracking-wide transition-colors duration-300',
                  'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-gold',
                  'after:transition-transform after:duration-500 after:ease-[var(--ease-cinematic)] hover:after:scale-x-100',
                  active ? 'text-gold after:scale-x-100' : 'text-ivory/85 hover:text-ivory',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    )
  }
  return (
    <ul className="space-y-1">
      {mainNav.map((item, index) => (
        <li key={item.href} className={animate ? 'animate-fade-up' : undefined} style={{ animationDelay: `${index * 60}ms` }}>
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            className="block py-2.5 font-serif text-3xl text-ivory transition-colors hover:text-gold aria-[current=page]:text-gold"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** The current path is request data: read it behind Suspense so every route keeps a static shell. */
function ActiveNavLinks(props: Omit<NavProps, 'pathname'>) {
  return <NavLinks {...props} pathname={usePathname()} />
}

function Nav(props: Omit<NavProps, 'pathname'>) {
  return (
    <Suspense fallback={<NavLinks {...props} pathname={null} />}>
      <ActiveNavLinks {...props} />
    </Suspense>
  )
}

export function Header({ phone }: { phone: string | null }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    toggleRef.current?.focus()
  }, [])

  // Drawer: lock page scroll, trap focus, close on Escape.
  useEffect(() => {
    if (!open) return
    const drawer = drawerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // The close toggle lives in the header; keep it inside the trap so it stays reachable.
    const focusables = () => [
      ...(toggleRef.current ? [toggleRef.current] : []),
      ...Array.from(drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []),
    ]
    focusables()[1]?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-700 ease-[var(--ease-cinematic)]',
          scrolled || open
            ? 'border-b border-ivory/10 bg-charcoal/90 backdrop-blur-md'
            : 'border-b border-transparent bg-gradient-to-b from-charcoal/70 to-transparent',
        )}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-gold focus:px-4 focus:py-2 focus:text-charcoal"
        >
          Skip to content
        </a>
        <div className="container-x flex h-20 items-center justify-between gap-6">
          <Link href="/" aria-label="Orange Salon — home" className="shrink-0">
            <Wordmark />
          </Link>
  
          <nav aria-label="Main" className="hidden lg:block">
            <Nav variant="desktop" />
          </nav>
  
          <div className="flex items-center gap-3">
            {phone && (
              <a
                href={telHref(phone)}
                className="hidden items-center gap-2 text-[0.8125rem] text-ivory/80 transition-colors hover:text-gold xl:inline-flex"
              >
                <Phone aria-hidden className="size-3.5" />
                {formatPhone(phone)}
              </a>
            )}
            {/* Wrapped so the breakpoint doesn't fight the button's own display class. */}
            <span className="hidden sm:block">
              <ButtonLink href="/book" size="sm">
                Book Appointment
              </ButtonLink>
            </span>
            <button
              ref={toggleRef}
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-sm text-ivory lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Outside <header>: its backdrop-filter would otherwise become the containing block of this fixed panel. */}
      <div
        ref={drawerRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-20 z-40 overflow-y-auto bg-charcoal lg:hidden"
      >
        <nav aria-label="Mobile" className="container-x flex min-h-full flex-col justify-between gap-10 py-10">
          <Nav variant="mobile" animate={open} onNavigate={() => setOpen(false)} />
          <div className="space-y-4 border-t border-ivory/10 pt-8">
            <ButtonLink href="/book" size="lg" arrow className="w-full" onClick={() => setOpen(false)}>
              Book Your Appointment
            </ButtonLink>
            {phone && (
              <a href={telHref(phone)} className="flex items-center justify-center gap-2 py-2 text-ivory/80">
                <Phone aria-hidden className="size-4" /> {formatPhone(phone)}
              </a>
            )}
          </div>
        </nav>
      </div>
    </>
  )
}
