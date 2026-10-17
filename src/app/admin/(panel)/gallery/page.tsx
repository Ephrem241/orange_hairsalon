import type { Metadata } from 'next'
import { NotPermitted, PageHeader } from '@/components/admin/ui'
import { mapGalleryItem } from '@/lib/data/mappers'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { createSessionClient } from '@/lib/supabase/server'
import { GalleryManager } from './GalleryManager'

export const metadata: Metadata = { title: 'Gallery' }

export default async function GalleryAdminPage() {
  if (!(await requirePageStaff(ADMIN_ONLY))) return <NotPermitted />
  const db = await createSessionClient()
  const { data } = await db.from('gallery_items').select('*').order('sort_order').order('created_at')
  return (
    <>
      <PageHeader
        title="Gallery"
        description="Real salon work first. Mark any stock or borrowed imagery as illustrative — it is labelled on the site. Before/after pairs must be genuine photos of the same client."
      />
      <GalleryManager items={(data ?? []).map(mapGalleryItem)} />
    </>
  )
}
