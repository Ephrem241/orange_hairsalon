import { api } from '@convex/_generated/api'
import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, NotPermitted, PageHeader, Table, Td, Th } from '@/components/admin/ui'
import { FRONT_DESK, requirePageStaff } from '@/lib/auth/staff'
import { cn } from '@/lib/cn'
import { staffQuery } from '@/lib/convex/server'
import { formatDateShort, formatTime } from '@/lib/time'
import { RetryButton } from './RetryButton'

export const metadata: Metadata = { title: 'Notifications' }

const STATUSES = ['sent', 'failed', 'skipped', 'pending'] as const

const TONE: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-800',
  failed: 'bg-red-50 text-red-800',
  skipped: 'bg-ivory-200 text-taupe-700',
  pending: 'bg-amber-50 text-amber-900',
}

export default async function NotificationsPage({ searchParams }: PageProps<'/admin/notifications'>) {
  if (!(await requirePageStaff(FRONT_DESK))) return <NotPermitted />
  const { status } = await searchParams
  const filter = typeof status === 'string' && STATUSES.includes(status as (typeof STATUSES)[number]) ? (status as (typeof STATUSES)[number]) : null
  const rows = await staffQuery(api.notifications.list, { status: filter ?? undefined })

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Every email and WhatsApp message the system tried to send. “Sent” means the provider accepted it; “Skipped” means the channel isn’t set up."
        actions={
          <div className="flex gap-1 text-sm">
            {[null, 'failed', 'skipped', 'sent'].map((s) => (
              <Link key={s ?? 'all'} href={s ? `/admin/notifications?status=${s}` : '/admin/notifications'} className={cn('rounded-full px-3 py-1', filter === s ? 'bg-charcoal text-ivory' : 'text-taupe-700 hover:text-charcoal')}>
                {s ?? 'All'}
              </Link>
            ))}
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="Nothing here yet">Notifications appear when bookings are made or changed.</EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>When</Th><Th>Event</Th><Th>Channel</Th><Th>Recipient</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>
            {rows.map((n) => {
              const at = new Date(n._creationTime)
              return (
                <tr key={n._id}>
                  <Td className="whitespace-nowrap">{formatDateShort(at)} {formatTime(at)}</Td>
                  <Td>
                    <span className="capitalize">{n.event.replace('_', ' ')}</span>
                    {n.appointmentId && n.reference && <Link href={`/admin/appointments/${n.appointmentId}`} className="block text-xs text-gold-700 hover:underline">{n.reference}</Link>}
                  </Td>
                  <Td className="capitalize">{n.channel}</Td>
                  <Td className="max-w-48 truncate">{n.recipient}</Td>
                  <Td>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', TONE[n.status])}>{n.status}</span>
                    {n.error && <span className="mt-1 block max-w-64 text-xs text-taupe-700">{n.error}</span>}
                  </Td>
                  <Td>{(n.status === 'failed' || n.status === 'skipped') && <RetryButton id={n._id} />}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </>
  )
}
