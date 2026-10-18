import { api } from '@convex/_generated/api'
import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, NotPermitted, PageHeader, Table, Td, Th } from '@/components/admin/ui'
import { FRONT_DESK, requirePageStaff } from '@/lib/auth/staff'
import { formatPhone } from '@/lib/format'
import { staffQuery } from '@/lib/convex/server'
import { formatDateShort } from '@/lib/time'

export const metadata: Metadata = { title: 'Customers' }

export default async function CustomersPage({ searchParams }: PageProps<'/admin/customers'>) {
  if (!(await requirePageStaff(FRONT_DESK))) return <NotPermitted />
  const { q: rawQ } = await searchParams
  const q = (typeof rawQ === 'string' ? rawQ : '').trim().slice(0, 100)

  const customers = await staffQuery(api.customers.list, { q: q || undefined })

  return (
    <>
      <PageHeader title="Customers" description="Clients are created automatically from bookings and matched by phone number." />
      <form method="get" className="mb-6 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, phone or email" className="h-10 w-full max-w-md rounded-sm border border-charcoal/20 bg-white px-3 text-sm" />
        <button className="h-10 rounded-sm bg-charcoal px-5 text-sm font-medium text-ivory">Search</button>
      </form>
      {customers.length === 0 ? (
        <EmptyState title={q ? 'No matching clients' : 'No clients yet'}>{q ? 'Try a different search.' : 'Clients appear here after their first booking.'}</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr><Th>Name</Th><Th>Phone</Th><Th>Email</Th><Th>Bookings</Th><Th>Last completed visit</Th></tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c._id} className="hover:bg-ivory-200/40">
                <Td><Link href={`/admin/customers/${c._id}`} className="font-medium hover:text-gold-700">{c.fullName}</Link></Td>
                <Td className="tabular-nums">{formatPhone(c.phoneE164)}</Td>
                <Td>{c.email ?? '—'}</Td>
                <Td className="tabular-nums">{c.visits}</Td>
                <Td>{c.lastVisit ? formatDateShort(new Date(c.lastVisit)) : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}
