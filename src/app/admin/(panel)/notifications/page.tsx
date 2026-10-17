import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, NotPermitted, PageHeader, Table, Td, Th } from '@/components/admin/ui'
import { FRONT_DESK, requirePageStaff } from '@/lib/auth/staff'
import { cn } from '@/lib/cn'
import { createSessionClient } from '@/lib/supabase/server'
import { formatDateShort, formatTime } from '@/lib/time'
import { RetryButton } from './RetryButton'

export const metadata: Metadata = { title: 'Notifications' }

const TONE: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-800',
  failed: 'bg-red-50 text-red-800',
  skipped: 'bg-ivory-200 text-taupe-700',
  pending: 'bg-amber-50 text-amber-900',
}

export default async function NotificationsPage({ searchParams }: PageProps<'/admin/notifications'>) {
  if (!(await requirePageStaff(FRONT_DESK))) return <NotPermitted />
  const { status } = await searchParams
  const filter = typeof status === 'string' && ['sent', 'failed', 'skipped', 'pending'].includes(status) ? status : null
  const db = await createSessionClient()
  let query = db
    .from('notification_log')
    .select('id, event, channel, recipient, status, error, attempts, created_at, sent_at, appointment:appointments(id, reference)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (filter) query = query.eq('status', filter)
  const { data } = await query

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
      {(data ?? []).length === 0 ? (
        <EmptyState title="Nothing here yet">Notifications appear when bookings are made or changed.</EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>When</Th><Th>Event</Th><Th>Channel</Th><Th>Recipient</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>
            {(data ?? []).map((n) => {
              const appt = n.appointment as unknown as { id: string; reference: string } | null
              return (
                <tr key={n.id}>
                  <Td className="whitespace-nowrap">{formatDateShort(n.created_at)} {formatTime(n.created_at)}</Td>
                  <Td>
                    <span className="capitalize">{n.event.replace('_', ' ')}</span>
                    {appt && <Link href={`/admin/appointments/${appt.id}`} className="block text-xs text-gold-700 hover:underline">{appt.reference}</Link>}
                  </Td>
                  <Td className="capitalize">{n.channel}</Td>
                  <Td className="max-w-48 truncate">{n.recipient}</Td>
                  <Td>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', TONE[n.status])}>{n.status}</span>
                    {n.error && <span className="mt-1 block max-w-64 text-xs text-taupe-700">{n.error}</span>}
                  </Td>
                  <Td>{(n.status === 'failed' || n.status === 'skipped') && <RetryButton id={n.id} />}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </>
  )
}
