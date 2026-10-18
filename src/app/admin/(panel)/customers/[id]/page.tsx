import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, NotPermitted, PageHeader, Table, Td, Th } from '@/components/admin/ui'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { listAppointments } from '@/lib/admin/data'
import { FRONT_DESK, requirePageStaff } from '@/lib/auth/staff'
import { formatEtb, formatPhone, telHref } from '@/lib/format'
import { staffQuery } from '@/lib/convex/server'
import { formatDateShort, formatTime } from '@/lib/time'
import { isConvexId } from '@/lib/validation'
import { CustomerForm } from './CustomerForm'

export const metadata: Metadata = { title: 'Client' }

export default async function CustomerPage({ params }: PageProps<'/admin/customers/[id]'>) {
  if (!(await requirePageStaff(FRONT_DESK))) return <NotPermitted />
  const { id } = await params
  if (!isConvexId(id)) notFound()
  const [c, history] = await Promise.all([
    staffQuery(api.customers.get, { id: id as Id<'customers'> }),
    listAppointments({ customerId: id, ascending: false, limit: 200 }),
  ])
  if (!c) notFound()
  const completed = history.filter((a) => a.status === 'completed')
  const spent = completed.reduce((sum, a) => sum + (a.amountPaidEtb ?? a.priceEtb), 0)

  return (
    <>
      <PageHeader
        back={{ href: '/admin/customers', label: 'Customers' }}
        title={c.fullName}
        description={<>Client since {formatDateShort(new Date(c._creationTime))} · <a href={telHref(c.phoneE164)} className="hover:text-gold-700">{formatPhone(c.phoneE164)}</a></>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <div className="space-y-6">
          <Card title="Profile">
            <CustomerForm id={c._id} fullName={c.fullName} email={c.email ?? ''} staffNotes={c.staffNotes ?? ''} />
          </Card>
          <Card title="Summary">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs text-taupe-700 uppercase">Bookings</dt><dd className="mt-1 font-serif text-2xl">{history.length}</dd></div>
              <div><dt className="text-xs text-taupe-700 uppercase">Completed</dt><dd className="mt-1 font-serif text-2xl">{completed.length}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-taupe-700 uppercase">Recorded spend</dt><dd className="mt-1 font-serif text-2xl">{formatEtb(spent)}</dd></div>
            </dl>
          </Card>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Appointment history</h2>
          <Table>
            <thead><tr><Th>When</Th><Th>Service</Th><Th>Stylist</Th><Th>Status</Th></tr></thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id} className="hover:bg-ivory-200/40">
                  <Td><Link href={`/admin/appointments/${a.id}`} className="font-medium hover:text-gold-700">{formatDateShort(a.startsAt)}, {formatTime(a.startsAt)}</Link></Td>
                  <Td>{a.serviceName}</Td>
                  <Td>{a.stylistName}</Td>
                  <Td><StatusBadge status={a.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </>
  )
}
