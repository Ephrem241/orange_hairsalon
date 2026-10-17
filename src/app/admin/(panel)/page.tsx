import type { Metadata } from 'next'
import Link from 'next/link'
import { AdminButtonLink, Card, EmptyState, PageHeader, StatCard } from '@/components/admin/ui'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { dashboardSummary, listAppointments } from '@/lib/admin/data'
import { can, requirePageStaff } from '@/lib/auth/staff'
import { formatEtb } from '@/lib/format'
import { createSessionClient } from '@/lib/supabase/server'
import { addDays, formatDateShort, formatTime, salonDate, salonInstant } from '@/lib/time'

export const metadata: Metadata = { title: 'Overview' }

const EVENT_LABEL: Record<string, string> = {
  created: 'New booking',
  confirmed: 'Confirmed',
  rejected: 'Request declined',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  completed: 'Completed',
  no_show: 'No-show',
}

export default async function OverviewPage() {
  const staff = (await requirePageStaff())!
  const today = salonDate()
  const startToday = salonInstant(today, '00:00')
  const startTomorrow = salonInstant(addDays(today, 1), '00:00')
  const [y, m] = today.split('-').map(Number)
  const monthStart = salonInstant(`${y}-${String(m).padStart(2, '0')}-01`, '00:00')
  const nextMonth = salonInstant(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, '00:00')
  const now = new Date().toISOString()
  const in30 = salonInstant(addDays(today, 30), '00:00')

  const db = await createSessionClient()
  const [todayList, pending, upcomingSummary, monthSummary, events] = await Promise.all([
    listAppointments({ from: startToday, to: startTomorrow, status: 'live' }),
    listAppointments({ from: now, status: 'pending', limit: 8 }),
    dashboardSummary(now, in30),
    dashboardSummary(monthStart, nextMonth),
    db
      .from('appointment_events')
      .select('id, event, actor_type, created_at, appointment:appointments(id, reference, customer_name, service_name, starts_at)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])
  const frontDesk = can.manageAppointments(staff)

  return (
    <>
      <PageHeader
        title={`Good day, ${staff.fullName.split(' ')[0]}`}
        description={`${formatDateShort(new Date())} · ${staff.role === 'stylist' ? 'Your appointments' : 'Salon overview'}`}
        actions={frontDesk && <AdminButtonLink href="/admin/appointments/new">+ New appointment</AdminButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today" value={todayList.length} hint="Pending and confirmed" />
        <StatCard label="Awaiting confirmation" value={upcomingSummary.pending} hint="Upcoming requests" tone={upcomingSummary.pending > 0 ? 'attention' : 'default'} />
        <StatCard label="Next 30 days" value={upcomingSummary.confirmed} hint={`Confirmed · expected ${formatEtb(upcomingSummary.expected_revenue_etb)}`} />
        <StatCard
          label="Recorded revenue this month"
          value={formatEtb(monthSummary.recorded_revenue_etb)}
          hint={`${monthSummary.completed} completed · ${monthSummary.cancelled} cancelled · ${monthSummary.no_show} no-show`}
        />
      </div>
      <p className="mt-3 text-xs text-taupe-700">
        Recorded revenue counts completed appointments only (amount recorded at checkout, or the listed price). Expected revenue is
        confirmed work not yet completed and is not money collected.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Today’s schedule" actions={<Link href={`/admin/appointments?view=day&date=${today}`} className="text-xs text-gold-700 hover:underline">Day view →</Link>} padded={false}>
          {todayList.length === 0 ? (
            <p className="p-5 text-sm text-taupe-700">No appointments today.</p>
          ) : (
            <ul className="divide-y divide-charcoal/5">
              {todayList.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/appointments/${a.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-ivory-200/50">
                    <span className="w-16 shrink-0 text-sm font-medium tabular-nums">{formatTime(a.startsAt)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.customerName}</span>
                      <span className="block truncate text-xs text-taupe-700">{a.serviceName} · {a.stylistName}</span>
                    </span>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {frontDesk && (
            <Card title="Requests to confirm" actions={<Link href="/admin/appointments?status=pending" className="text-xs text-gold-700 hover:underline">All →</Link>} padded={false}>
              {pending.length === 0 ? (
                <p className="p-5 text-sm text-taupe-700">You’re all caught up.</p>
              ) : (
                <ul className="divide-y divide-charcoal/5">
                  {pending.map((a) => (
                    <li key={a.id}>
                      <Link href={`/admin/appointments/${a.id}`} className="block px-5 py-3 hover:bg-ivory-200/50">
                        <span className="flex justify-between gap-3 text-sm">
                          <span className="truncate font-medium">{a.customerName}</span>
                          <span className="shrink-0 text-taupe-700 tabular-nums">{formatDateShort(a.startsAt)}, {formatTime(a.startsAt)}</span>
                        </span>
                        <span className="block truncate text-xs text-taupe-700">{a.serviceName} · {a.stylistName}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card title="Recent activity" padded={false}>
            {(events.data ?? []).length === 0 ? (
              <div className="p-5">
                <EmptyState title="No activity yet">Bookings and changes will appear here.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-charcoal/5">
                {(events.data ?? []).map((e) => {
                  const appt = e.appointment as unknown as { id: string; reference: string; customer_name: string; service_name: string } | null
                  if (!appt) return null
                  return (
                    <li key={e.id}>
                      <Link href={`/admin/appointments/${appt.id}`} className="block px-5 py-3 text-sm hover:bg-ivory-200/50">
                        <span className="font-medium">{EVENT_LABEL[e.event] ?? e.event}</span>
                        <span className="text-taupe-700"> · {appt.customer_name} · {appt.reference}</span>
                        <span className="block text-xs text-taupe-700">
                          {e.actor_type === 'customer' ? 'By client online' : e.actor_type === 'staff' ? 'By staff' : 'System'} · {formatDateShort(e.created_at)} {formatTime(e.created_at)}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
