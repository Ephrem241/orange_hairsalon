import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Card, NotPermitted, PageHeader } from '@/components/admin/ui'
import { listServices, listStylists, upcomingTimeOff } from '@/lib/admin/data'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { staffQuery } from '@/lib/convex/server'
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
  const [detail, timeOff] = await Promise.all([staffQuery(api.stylists.detail, { id: stylist.id as Id<'stylists'> }), upcomingTimeOff(stylist.id)])
  if (!detail) notFound()
  const { contact, hours, breaks } = detail

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
            <TimeOffManager stylistId={stylist.id} entries={timeOff} />
          </Card>
        </div>
        <Card title="Weekly hours & breaks" className="xl:col-span-2">
          <ScheduleEditor
            stylistId={stylist.id}
            hours={hours.map((h) => ({ weekday: h.weekday, start: h.startsAt, end: h.endsAt }))}
            breaks={breaks.map((b) => ({ weekday: b.weekday, start: b.startsAt, end: b.endsAt, label: b.label ?? '' }))}
          />
        </Card>
      </div>
    </>
  )
}
