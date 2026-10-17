import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, PageHeader } from '@/components/admin/ui'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { getAppointment, listStylists } from '@/lib/admin/data'
import { can, requirePageStaff } from '@/lib/auth/staff'
import { cn } from '@/lib/cn'
import { formatDuration, formatEtb, formatPhone, telHref } from '@/lib/format'
import { formatDateLong, formatDateShort, formatTime, hasStarted } from '@/lib/time'
import { AppointmentActions } from './AppointmentActions'

export const metadata: Metadata = { title: 'Appointment' }

const EVENT_LABEL: Record<string, string> = {
  created: 'Booked',
  confirmed: 'Confirmed',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  completed: 'Completed',
  no_show: 'Marked no-show',
}

const NOTIFY_TONE: Record<string, string> = {
  sent: 'text-emerald-800 bg-emerald-50',
  failed: 'text-red-800 bg-red-50',
  skipped: 'text-taupe-700 bg-ivory-200',
  pending: 'text-amber-900 bg-amber-50',
}

export default async function AppointmentPage({ params }: PageProps<'/admin/appointments/[id]'>) {
  const staff = (await requirePageStaff())!
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [detail, stylists] = await Promise.all([getAppointment(id), listStylists()])
  if (!detail) notFound()
  const { appointment: a, events, notifications } = detail
  const started = hasStarted(a.startsAt)

  return (
    <>
      <PageHeader
        back={{ href: '/admin/appointments', label: 'Appointments' }}
        title={`${a.customerName} · ${a.serviceName}`}
        description={`${formatDateLong(a.startsAt)}, ${formatTime(a.startsAt)} – ${formatTime(a.endsAt)} · ${a.reference}`}
        actions={<StatusBadge status={a.status} className="text-sm" />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card title="Details">
            <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <Item label="Client">
                <Link href={`/admin/customers/${a.customerId}`} className="font-medium hover:text-gold-700">{a.customerName}</Link>
              </Item>
              <Item label="Phone">
                <a href={telHref(a.customerPhone)} className="hover:text-gold-700">{formatPhone(a.customerPhone)}</a>
              </Item>
              <Item label="Email">{a.customerEmail ?? '—'}</Item>
              <Item label="Booked via">{{ online: 'Website', phone: 'Phone', walk_in: 'Walk-in' }[a.source] ?? a.source}</Item>
              <Item label="Stylist">{a.stylistName}</Item>
              <Item label="Duration">{formatDuration(a.durationMin)} + {a.bufferMin} min clean-up</Item>
              <Item label="Listed price">{formatEtb(a.priceEtb, a.priceType)}</Item>
              <Item label="Paid">{a.amountPaidEtb !== null ? formatEtb(a.amountPaidEtb) : a.status === 'completed' ? `${formatEtb(a.priceEtb)} (listed)` : 'Not yet — paid at the salon'}</Item>
              {a.customerNotes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs tracking-wide text-taupe-700 uppercase">Client notes</dt>
                  <dd className="mt-1 whitespace-pre-line">{a.customerNotes}</dd>
                </div>
              )}
              {a.cancelReason && (
                <div className="sm:col-span-2">
                  <dt className="text-xs tracking-wide text-taupe-700 uppercase">Cancellation reason ({a.cancelledBy ?? 'unknown'})</dt>
                  <dd className="mt-1">{a.cancelReason}</dd>
                </div>
              )}
            </dl>
          </Card>

          {can.manageAppointments(staff) ? (
            <Card title="Actions">
              <AppointmentActions
                id={a.id}
                status={a.status}
                started={started}
                serviceId={a.serviceId}
                stylistId={a.stylistId}
                priceEtb={a.priceEtb}
                internalNotes={a.internalNotes}
                stylists={stylists.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.displayName, serviceIds: s.serviceIds }))}
              />
            </Card>
          ) : (
            a.internalNotes && <Card title="Internal notes"><p className="text-sm whitespace-pre-line">{a.internalNotes}</p></Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Timeline" padded={false}>
            <ol className="divide-y divide-charcoal/5">
              {events.map((e) => (
                <li key={e.id} className="px-5 py-3 text-sm">
                  <p className="font-medium">{EVENT_LABEL[e.event] ?? e.event}</p>
                  <p className="text-xs text-taupe-700">
                    {e.actor_type === 'customer' ? 'Client (online)' : e.actor_type === 'staff' ? 'Staff' : 'System'} · {formatDateShort(e.created_at)} {formatTime(e.created_at)}
                  </p>
                  {typeof e.details?.reason === 'string' && <p className="mt-1 text-xs">“{e.details.reason}”</p>}
                  {e.event === 'rescheduled' && typeof e.details?.from === 'string' && typeof e.details?.to === 'string' && (
                    <p className="mt-1 text-xs text-taupe-700">
                      {formatDateShort(e.details.from)} {formatTime(e.details.from)} → {formatDateShort(e.details.to)} {formatTime(e.details.to)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Card>

          {can.manageAppointments(staff) && (
            <Card title="Notifications" padded={false}>
              {notifications.length === 0 ? (
                <p className="p-5 text-sm text-taupe-700">No notifications recorded (client gave no email, or channels are switched off).</p>
              ) : (
                <ul className="divide-y divide-charcoal/5">
                  {notifications.map((n) => (
                    <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium capitalize">{n.event.replace('_', ' ')} · {n.channel}</p>
                        <p className="truncate text-xs text-taupe-700">{n.recipient}</p>
                        {n.error && <p className="mt-1 text-xs text-taupe-700">{n.error}</p>}
                      </div>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize', NOTIFY_TONE[n.status])}>{n.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-taupe-700 uppercase">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  )
}
