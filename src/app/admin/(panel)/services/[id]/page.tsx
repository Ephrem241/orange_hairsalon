import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NotPermitted, PageHeader } from '@/components/admin/ui'
import { listCategories, listServices } from '@/lib/admin/data'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { ServiceForm } from './ServiceForm'

export const metadata: Metadata = { title: 'Edit service' }

export default async function EditServicePage({ params }: PageProps<'/admin/services/[id]'>) {
  if (!(await requirePageStaff(ADMIN_ONLY))) return <NotPermitted />
  const { id } = await params
  const [services, categories] = await Promise.all([listServices(), listCategories()])
  const service = id === 'new' ? null : services.find((s) => s.id === id)
  if (id !== 'new' && !service) notFound()
  return (
    <>
      <PageHeader back={{ href: '/admin/services', label: 'Services' }} title={service ? service.name : 'New service'} />
      <ServiceForm
        service={service ?? null}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        nextSortOrder={(services.length + 1) * 10}
      />
    </>
  )
}
