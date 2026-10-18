import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { AdminButtonLink, EmptyState, NotPermitted, PageHeader, Table, Td, Th } from '@/components/admin/ui'
import { DemoBadge } from '@/components/site/DemoBadge'
import { listCategories, listServices } from '@/lib/admin/data'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { formatDuration, formatEtb } from '@/lib/format'
import { CategoryManager } from './CategoryManager'

export const metadata: Metadata = { title: 'Services' }

export default async function ServicesAdminPage() {
  if (!(await requirePageStaff(ADMIN_ONLY))) return <NotPermitted />
  const [services, categories] = await Promise.all([listServices(), listCategories()])
  return (
    <>
      <PageHeader title="Services" description="The menu clients can book online. Prices are in ETB and validated on save." actions={<AdminButtonLink href="/admin/services/new">+ New service</AdminButtonLink>} />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        {services.length === 0 ? (
          <EmptyState title="No services yet" action={<AdminButtonLink href="/admin/services/new">Add your first service</AdminButtonLink>}>
            Add the salon’s real services with prices and durations to open online booking.
          </EmptyState>
        ) : (
          <Table>
            <thead><tr><Th>Service</Th><Th>Category</Th><Th>Price</Th><Th>Duration</Th><Th>Status</Th></tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-ivory-200/40">
                  <Td>
                    <Link href={`/admin/services/${s.id}`} className="flex items-center gap-3 font-medium hover:text-gold-700">
                      <span className="relative size-10 shrink-0 overflow-hidden rounded-sm bg-ivory-200">
                        {s.imageUrl && <Image src={s.imageUrl} alt="" fill sizes="40px" className="object-cover" />}
                      </span>
                      {s.name}
                      {s.isDemo && <DemoBadge />}
                    </Link>
                  </Td>
                  <Td>{s.categoryName ?? '—'}</Td>
                  <Td className="tabular-nums">{formatEtb(s.priceEtb, s.priceType)}</Td>
                  <Td>{formatDuration(s.durationMin)}</Td>
                  <Td>
                    <span className={s.isActive ? 'text-emerald-800' : 'text-taupe-700'}>{s.isActive ? 'Bookable' : 'Hidden'}</span>
                    {s.isFeatured && <span className="ml-2 text-xs text-gold-700">★ Featured</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <CategoryManager categories={categories.map((c) => ({ id: c.id, name: c.name, description: c.description ?? '', sortOrder: c.sortOrder }))} />
      </div>
    </>
  )
}
