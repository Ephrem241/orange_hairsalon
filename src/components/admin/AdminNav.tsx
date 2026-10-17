'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Bell, CalendarDays, ClipboardList, Contact, GalleryHorizontalEnd, LayoutDashboard, LogOut, Menu, MessageSquare,
  Scissors, Settings, ShieldCheck, Star, UserCog, Users, X, type LucideIcon,
} from 'lucide-react'
import { Wordmark } from '@/components/site/Wordmark'
import { cn } from '@/lib/cn'
import type { StaffRole } from '@/lib/types'

type Item = { href: string; label: string; icon: LucideIcon; roles: StaffRole[] }

const ALL: StaffRole[] = ['admin', 'receptionist', 'stylist']
const DESK: StaffRole[] = ['admin', 'receptionist']
const ADMIN: StaffRole[] = ['admin']

const SECTIONS: { label: string; items: Item[] }[] = [
  {
    label: 'Daily',
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard, roles: ALL },
      { href: '/admin/appointments', label: 'Appointments', icon: CalendarDays, roles: ALL },
      { href: '/admin/customers', label: 'Customers', icon: Users, roles: DESK },
      { href: '/admin/messages', label: 'Messages', icon: MessageSquare, roles: DESK },
      { href: '/admin/notifications', label: 'Notifications', icon: Bell, roles: DESK },
      { href: '/admin/schedule', label: 'My schedule', icon: ClipboardList, roles: ['stylist'] },
    ],
  },
  {
    label: 'Salon',
    items: [
      { href: '/admin/services', label: 'Services', icon: Scissors, roles: ADMIN },
      { href: '/admin/stylists', label: 'Stylists & hours', icon: Contact, roles: ADMIN },
      { href: '/admin/gallery', label: 'Gallery', icon: GalleryHorizontalEnd, roles: ADMIN },
      { href: '/admin/reviews', label: 'Reviews', icon: Star, roles: ADMIN },
      { href: '/admin/settings', label: 'Settings', icon: Settings, roles: ADMIN },
      { href: '/admin/staff', label: 'Staff & access', icon: UserCog, roles: ADMIN },
      { href: '/admin/audit', label: 'Audit log', icon: ShieldCheck, roles: ADMIN },
    ],
  },
]

const ROLE_LABEL: Record<StaffRole, string> = { admin: 'Owner / admin', receptionist: 'Reception', stylist: 'Stylist' }

export function AdminNav({ role, name, signOut }: { role: StaffRole; name: string; signOut: () => Promise<void> }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const active = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href))

  const nav = (
    <nav aria-label="Dashboard" className="flex h-full flex-col">
      <div className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
        {SECTIONS.map((section) => {
          const items = section.items.filter((i) => i.roles.includes(role))
          if (items.length === 0) return null
          return (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[0.6875rem] font-semibold tracking-[0.16em] text-ivory/40 uppercase">{section.label}</p>
              <ul className="space-y-0.5">
                {items.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active(href) ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors',
                        active(href) ? 'bg-ivory/10 text-ivory' : 'text-ivory/65 hover:bg-ivory/5 hover:text-ivory',
                      )}
                    >
                      <Icon aria-hidden className={cn('size-4', active(href) && 'text-gold')} />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      <div className="border-t border-ivory/10 p-4">
        <Link href="/admin/account" onClick={() => setOpen(false)} className="block rounded-sm px-2 py-1.5 hover:bg-ivory/5">
          <p className="truncate text-sm text-ivory">{name}</p>
          <p className="text-xs text-ivory/50">{ROLE_LABEL[role]}</p>
        </Link>
        <form action={signOut}>
          <button type="submit" className="mt-2 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ivory/60 hover:bg-ivory/5 hover:text-ivory">
            <LogOut aria-hidden className="size-4" /> Sign out
          </button>
        </form>
      </div>
    </nav>
  )

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-charcoal lg:flex">
        <Link href="/admin" className="flex h-16 items-center px-6" aria-label="Dashboard home">
          <Wordmark className="scale-90" />
        </Link>
        {nav}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-charcoal px-4 lg:hidden">
        <Link href="/admin" aria-label="Dashboard home">
          <Wordmark className="origin-left scale-75" />
        </Link>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="admin-mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} className="inline-flex size-10 items-center justify-center text-ivory">
          {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        </button>
      </header>
      {open && (
        <div id="admin-mobile-nav" className="fixed inset-x-0 top-14 bottom-0 z-30 bg-charcoal lg:hidden">
          {nav}
        </div>
      )}
    </>
  )
}
