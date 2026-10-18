import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { AdminButtonLink, EmptyState, NotPermitted, PageHeader } from '@/components/admin/ui'
import { DemoBadge } from '@/components/site/DemoBadge'
import { listServices, listStylists } from '@/lib/admin/data'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { initials } from '@/lib/format'

export const metadata: Metadata = { title: 'Stylists' }

export default async function StylistsPage() {
  if (!(await requirePageStaff(ADMIN_ONLY))) return <NotPermitted />
  const [stylists, services] = await Promise.all([listStylists(), listServices()])
  const serviceName = Object.fromEntries(services.map((s) => [s.id, s.name]))
  return (
    <>
      <PageHeader title="Stylists & hours" description="Profiles, the services each person performs, weekly hours and time off." actions={<AdminButtonLink href="/admin/stylists/new">+ New stylist</AdminButtonLink>} />
      {stylists.length === 0 ? (
        <EmptyState title="No stylists yet" action={<AdminButtonLink href="/admin/stylists/new">Add a stylist</AdminButtonLink>}>
          Add your team so clients can book them and the diary knows who works when.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stylists.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/stylists/${s.id}`} className="flex gap-4 rounded-md border border-charcoal/10 bg-white p-4 transition-colors hover:border-gold-600">
                <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-charcoal font-serif text-lg text-gold">
                  {s.photoUrl ? <Image src={s.photoUrl} alt="" fill sizes="64px" className="object-cover" /> : initials(s.displayName)}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-medium">{s.displayName} {s.isDemo && <DemoBadge />}</span>
                  <span className="block text-xs text-taupe-700">{s.title ?? 'Stylist'} · {s.isActive ? (s.acceptsOnlineBooking ? 'Bookable online' : 'Not bookable online') : 'Inactive'}</span>
                  <span className="mt-1 line-clamp-2 block text-xs text-taupe-700">{s.serviceIds.map((id) => serviceName[id]).filter(Boolean).join(', ') || 'No services assigned'}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
