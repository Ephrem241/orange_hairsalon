import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Card, NotPermitted, PageHeader } from '@/components/admin/ui'
import { listServices, listStylists } from '@/lib/admin/data'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { createSessionClient } from '@/lib/supabase/server'
import { ScheduleEditor } from './ScheduleEditor'
import { StylistProfileForm } from './StylistProfileForm'
import { StylistServicesForm } from './StylistServicesForm'
import { TimeOffManager } from './TimeOffManager'

export const metadata: Metadata = { title: 'Stylist' }

export default async function StylistPage({ params }: PageProps<'/admin/stylists/[id]'>) {
  if (!(await requirePageStaff(ADMIN_ONLY))) return <NotPermitted />
  const { id } = await params
  const [stylists, services] = await Promise.all([listStylists(), listServices()])

  if (id === 'new') {
    return (
      <>
        <PageHeader back={{ href: '/admin/stylists', label: 'Stylists' }} title="New stylist" description="Save the profile first, then add services, hours and time off." />
        <StylistProfileForm stylist={null} contact={null} nextSortOrder={(stylists.length + 1) * 10} />
      </>
    )
  }

  const stylist = stylists.find((s) => s.id === id)
  if (!stylist) notFound()
  const db = await createSessionClient()
  const [{ data: contact }, { data: hours }, { data: breaks }, { data: timeOff }] = await Promise.all([
    db.from('stylist_contacts').select('phone, email').eq('stylist_id', id).maybeSingle(),
    db.from('working_hours').select('weekday, starts_at, ends_at').eq('stylist_id', id).order('weekday').order('starts_at'),
    db.from('stylist_breaks').select('weekday, starts_at, ends_at, label').eq('stylist_id', id).order('weekday').order('starts_at'),
    db.from('time_off').select('id, starts_at, ends_at, reason').eq('stylist_id', id).gte('ends_at', new Date().toISOString()).order('starts_at'),
  ])
  const hhmm = (t: string) => t.slice(0, 5)

  return (
    <>
      <PageHeader back={{ href: '/admin/stylists', label: 'Stylists' }} title={stylist.displayName} description={stylist.title ?? undefined} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Profile">
          <StylistProfileForm stylist={stylist} contact={contact ? { phone: contact.phone ?? '', email: contact.email ?? '' } : null} nextSortOrder={stylist.sortOrder} />
        </Card>
        <div className="space-y-6">
          <Card title="Services they perform">
            <StylistServicesForm stylistId={stylist.id} selected={stylist.serviceIds} services={services.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive }))} />
          </Card>
          <Card title="Upcoming time off">
            <TimeOffManager stylistId={stylist.id} entries={(timeOff ?? []).map((t) => ({ id: t.id, startsAt: t.starts_at, endsAt: t.ends_at, reason: t.reason }))} />
          </Card>
        </div>
        <Card title="Weekly hours & breaks" className="xl:col-span-2">
          <ScheduleEditor
            stylistId={stylist.id}
            hours={(hours ?? []).map((h) => ({ weekday: h.weekday, start: hhmm(h.starts_at), end: hhmm(h.ends_at) }))}
            breaks={(breaks ?? []).map((b) => ({ weekday: b.weekday, start: hhmm(b.starts_at), end: hhmm(b.ends_at), label: b.label ?? '' }))}
          />
        </Card>
      </div>
    </>
  )
}
