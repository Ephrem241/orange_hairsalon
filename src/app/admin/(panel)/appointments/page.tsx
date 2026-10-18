import { api } from '@convex/_generated/api'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AdminButtonLink, EmptyState, PageHeader, Table, Td, Th } from '@/components/admin/ui'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { listAppointments, listServices, listStylists, type AdminAppointment } from '@/lib/admin/data'
import { can, requirePageStaff } from '@/lib/auth/staff'
import { cn } from '@/lib/cn'
import { formatEtb, formatPhone } from '@/lib/format'
import { STATUS } from '@/lib/status'
import { publicQuery, staffQuery } from '@/lib/convex/server'
import { addDays, formatDateShort, formatIsoDate, formatTime, formatTime24, isIsoDate, salonDate, salonInstant, weekdayOf } from '@/lib/time'
import type { AppointmentStatus } from '@/lib/types'

export const metadata: Metadata = { title: 'Appointments' }

const STATUSES = Object.keys(STATUS) as AppointmentStatus[]

export default async function AppointmentsPage({ searchParams }: PageProps<'/admin/appointments'>) {
  const staff = (await requirePageStaff())!
  const sp = await searchParams
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)
  const view = one('view') === 'day' ? 'day' : 'list'
  const today = salonDate()

  const [stylists, services] = await Promise.all([listStylists(), listServices()])

  if (view === 'day') {
    const date = isIsoDate(one('date')) ? one('date')! : today
    return <DayView date={date} stylists={stylists.filter((s) => s.isActive || s.id === staff.stylistId)} canCreate={can.manageAppointments(staff)} />
  }

  const from = isIsoDate(one('from')) ? one('from')! : today
  const to = isIsoDate(one('to')) ? one('to')! : addDays(today, 14)
  const statusParam = one('status')
  const status = statusParam && (STATUSES as string[]).includes(statusParam) ? (statusParam as AppointmentStatus) : undefined
  const filters = {
    from: salonInstant(from, '00:00'),
    to: salonInstant(addDays(to, 1), '00:00'),
    status,
    stylistId: one('stylist') || undefined,
    serviceId: one('service') || undefined,
    q: one('q') || undefined,
  }
  const appointments = await listAppointments(filters)

  return (
    <>
      <PageHeader
        title="Appointments"
        description={`${appointments.length} appointment${appointments.length === 1 ? '' : 's'} · ${formatIsoDate(from, 'short')} – ${formatIsoDate(to, 'short')}`}
        actions={
          <>
            <AdminButtonLink href={`/admin/appointments?view=day&date=${today}`} variant="outline">Day view</AdminButtonLink>
            {can.manageAppointments(staff) && <AdminButtonLink href="/admin/appointments/new">+ New appointment</AdminButtonLink>}
          </>
        }
      />

      <form className="mb-6 grid gap-3 rounded-md border border-charcoal/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <label className="text-xs font-medium text-taupe-700 lg:col-span-2">
          Search
          <input name="q" defaultValue={one('q')} placeholder="Name, phone or reference" className="mt-1 block h-10 w-full rounded-sm border border-charcoal/20 px-3 text-sm text-charcoal" />
        </label>
        <label className="text-xs font-medium text-taupe-700">
          From
          <input type="date" name="from" defaultValue={from} className="mt-1 block h-10 w-full rounded-sm border border-charcoal/20 px-3 text-sm text-charcoal" />
        </label>
        <label className="text-xs font-medium text-taupe-700">
          To
          <input type="date" name="to" defaultValue={to} className="mt-1 block h-10 w-full rounded-sm border border-charcoal/20 px-3 text-sm text-charcoal" />
        </label>
        <label className="text-xs font-medium text-taupe-700">
          Status
          <select name="status" defaultValue={status ?? ''} className="mt-1 block h-10 w-full rounded-sm border border-charcoal/20 bg-white px-2 text-sm text-charcoal">
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS[s].label}</option>
            ))}
          </select>
        </label>
        {staff.role !== 'stylist' && (
          <label className="text-xs font-medium text-taupe-700">
            Stylist
            <select name="stylist" defaultValue={one('stylist') ?? ''} className="mt-1 block h-10 w-full rounded-sm border border-charcoal/20 bg-white px-2 text-sm text-charcoal">
              <option value="">All</option>
              {stylists.map((s) => (
                <option key={s.id} value={s.id}>{s.displayName}</option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs font-medium text-taupe-700">
          Service
          <select name="service" defaultValue={one('service') ?? ''} className="mt-1 block h-10 w-full rounded-sm border border-charcoal/20 bg-white px-2 text-sm text-charcoal">
            <option value="">All</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2 lg:col-span-5 lg:justify-end">
          <Link href="/admin/appointments" className="inline-flex h-10 items-center px-3 text-sm text-taupe-700 hover:text-charcoal">Reset</Link>
          <button type="submit" className="inline-flex h-10 items-center rounded-sm bg-charcoal px-5 text-sm font-medium text-ivory hover:bg-charcoal-700">Apply filters</button>
        </div>
      </form>

      {appointments.length === 0 ? (
        <EmptyState title="No appointments match">Try widening the dates or clearing the filters.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Client</Th>
              <Th>Service</Th>
              <Th>Stylist</Th>
              <Th>Status</Th>
              <Th className="text-right">Price</Th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id} className="hover:bg-ivory-200/40">
                <Td>
                  <Link href={`/admin/appointments/${a.id}`} className="font-medium hover:text-gold-700">
                    {formatDateShort(a.startsAt)}
                  </Link>
                  <span className="block text-xs text-taupe-700 tabular-nums">{formatTime(a.startsAt)} – {formatTime(a.endsAt)}</span>
                </Td>
                <Td>
                  <Link href={`/admin/appointments/${a.id}`} className="font-medium hover:text-gold-700">{a.customerName}</Link>
                  <span className="block text-xs text-taupe-700">{formatPhone(a.customerPhone)} · {a.reference}</span>
                </Td>
                <Td>{a.serviceName}</Td>
                <Td>{a.stylistName}</Td>
                <Td><StatusBadge status={a.status} /></Td>
                <Td className="text-right tabular-nums">{formatEtb(a.priceEtb, a.priceType)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}

const PX_PER_MIN = 1.4

async function DayView({ date, stylists, canCreate }: { date: string; stylists: Awaited<ReturnType<typeof listStylists>>; canCreate: boolean }) {
  const start = salonInstant(date, '00:00')
  const end = salonInstant(addDays(date, 1), '00:00')
  const [appointments, allHours, offRows] = await Promise.all([
    listAppointments({ from: start, to: end }),
    publicQuery(api.public.businessHours, {}),
    staffQuery(api.stylists.timeOffInRange, { from: Date.parse(start), to: Date.parse(end) }),
  ])
  const hours = allHours.find((h) => h.weekday === weekdayOf(date))
  const timeOff = offRows.map((t) => ({ id: t._id, stylistId: t.stylistId ?? null, startsAt: new Date(t.startsAt).toISOString(), endsAt: new Date(t.endsAt).toISOString(), reason: t.reason ?? null }))
  const open = hours && !hours.isClosed && hours.opensAt ? hours.opensAt : '08:00'
  const close = hours && !hours.isClosed && hours.closesAt ? hours.closesAt : '20:00'
  const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
  const gridStart = Math.floor(toMin(open) / 60) * 60
  const gridEnd = Math.ceil(toMin(close) / 60) * 60
  const minuteOf = (iso: string) => toMin(formatTime24(iso))
  const top = (iso: string) => Math.max(0, (minuteOf(iso) - gridStart) * PX_PER_MIN)
  const columns = stylists.length ? stylists : [{ id: 'none', displayName: 'Team' } as (typeof stylists)[number]]
  const live = appointments.filter((a) => a.status !== 'cancelled')

  return (
    <>
      <PageHeader
        title={formatIsoDate(date)}
        description={`${live.length} appointment${live.length === 1 ? '' : 's'}${hours?.isClosed ? ' · salon closed' : ` · open ${open}–${close}`}`}
        actions={
          <>
            <AdminButtonLink href={`/admin/appointments?view=day&date=${addDays(date, -1)}`} variant="outline"><ChevronLeft aria-hidden className="size-4" /> Previous</AdminButtonLink>
            <AdminButtonLink href={`/admin/appointments?view=day&date=${salonDate()}`} variant="outline">Today</AdminButtonLink>
            <AdminButtonLink href={`/admin/appointments?view=day&date=${addDays(date, 1)}`} variant="outline">Next <ChevronRight aria-hidden className="size-4" /></AdminButtonLink>
            <AdminButtonLink href={`/admin/appointments?from=${date}&to=${date}`} variant="outline">List</AdminButtonLink>
            {canCreate && <AdminButtonLink href="/admin/appointments/new">+ New</AdminButtonLink>}
          </>
        }
      />
      <div className="overflow-x-auto rounded-md border border-charcoal/10 bg-white">
        <div className="grid min-w-[44rem]" style={{ gridTemplateColumns: `4rem repeat(${columns.length}, minmax(10rem, 1fr))` }}>
          <div className="sticky top-0 border-b border-charcoal/10 bg-ivory-200/60" />
          {columns.map((s) => (
            <div key={s.id} className="border-b border-l border-charcoal/10 bg-ivory-200/60 px-3 py-2.5 text-sm font-semibold">{s.displayName}</div>
          ))}
          <div className="relative" style={{ height: (gridEnd - gridStart) * PX_PER_MIN }}>
            {Array.from({ length: (gridEnd - gridStart) / 60 }, (_, i) => (
              <span key={i} className="absolute right-2 -translate-y-1/2 text-[0.6875rem] text-taupe-700 tabular-nums" style={{ top: i * 60 * PX_PER_MIN }}>
                {String((gridStart / 60 + i) % 24).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {columns.map((s) => (
            <div key={s.id} className="relative border-l border-charcoal/10" style={{ height: (gridEnd - gridStart) * PX_PER_MIN }}>
              {Array.from({ length: (gridEnd - gridStart) / 60 }, (_, i) => (
                <div key={i} aria-hidden className="absolute inset-x-0 border-t border-charcoal/5" style={{ top: i * 60 * PX_PER_MIN }} />
              ))}
              {timeOff
                .filter((t) => t.stylistId === s.id || t.stylistId === null)
                .map((t) => {
                  // Clamp to this day (compare as instants, not as strings).
                  const from = new Date(t.startsAt) < new Date(start) ? start : t.startsAt
                  const to = new Date(t.endsAt) > new Date(end) ? end : t.endsAt
                  const height = Math.max(18, (new Date(to).getTime() - new Date(from).getTime()) / 60000 * PX_PER_MIN)
                  return (
                    <div key={t.id} className="absolute inset-x-1 rounded-sm bg-[repeating-linear-gradient(135deg,#efe7dc,#efe7dc_6px,#e6dacb_6px,#e6dacb_12px)] px-2 py-1 text-[0.6875rem] text-taupe-700" style={{ top: top(from), height: Math.min(height, (gridEnd - gridStart) * PX_PER_MIN) }}>
                      {t.reason ?? 'Time off'}
                    </div>
                  )
                })}
              {live
                .filter((a) => a.stylistId === s.id)
                .map((a) => <DayBlock key={a.id} a={a} top={top(a.startsAt)} />)}
            </div>
          ))}
        </div>
      </div>
      {appointments.some((a) => a.status === 'cancelled') && (
        <p className="mt-3 text-xs text-taupe-700">Cancelled appointments are hidden from the grid; see the list view.</p>
      )}
    </>
  )
}

function DayBlock({ a, top }: { a: AdminAppointment; top: number }) {
  const height = Math.max(28, a.durationMin * PX_PER_MIN - 2)
  return (
    <Link
      href={`/admin/appointments/${a.id}`}
      className={cn(
        'absolute inset-x-1 overflow-hidden rounded-sm border-l-4 px-2 py-1 text-xs shadow-sm transition-shadow hover:shadow-md',
        a.status === 'pending' && 'border-amber-500 bg-amber-50',
        a.status === 'confirmed' && 'border-emerald-600 bg-emerald-50',
        a.status === 'completed' && 'border-stone-400 bg-stone-100',
        a.status === 'no_show' && 'border-zinc-400 bg-zinc-100 line-through',
      )}
      style={{ top, height }}
    >
      <span className="block font-semibold tabular-nums">{formatTime(a.startsAt)} {a.customerName}</span>
      <span className="block truncate text-taupe-700">{a.serviceName}</span>
    </Link>
  )
}
