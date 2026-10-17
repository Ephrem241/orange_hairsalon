import type { Metadata } from 'next'
import { EmptyState, NotPermitted, PageHeader } from '@/components/admin/ui'
import { listServices, listStylists } from '@/lib/admin/data'
import { FRONT_DESK, requirePageStaff } from '@/lib/auth/staff'
import { NewAppointmentForm } from './NewAppointmentForm'

export const metadata: Metadata = { title: 'New appointment' }

export default async function NewAppointmentPage() {
  if (!(await requirePageStaff(FRONT_DESK))) return <NotPermitted />
  const [services, stylists] = await Promise.all([listServices(), listStylists()])
  const active = services.filter((s) => s.isActive)
  return (
    <>
      <PageHeader back={{ href: '/admin/appointments', label: 'Appointments' }} title="New appointment" description="For bookings taken by phone or in person. Availability is checked again when you save." />
      {active.length === 0 || stylists.length === 0 ? (
        <EmptyState title="Add services and stylists first">Appointments need at least one active service and a stylist who performs it.</EmptyState>
      ) : (
        <NewAppointmentForm
          services={active.map((s) => ({ id: s.id, name: s.name, priceEtb: s.priceEtb, priceType: s.priceType, durationMin: s.durationMin }))}
          stylists={stylists.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.displayName, serviceIds: s.serviceIds }))}
        />
      )}
    </>
  )
}
