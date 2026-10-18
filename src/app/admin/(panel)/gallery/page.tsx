import { api } from '@convex/_generated/api'
import type { Metadata } from 'next'
import { NotPermitted, PageHeader } from '@/components/admin/ui'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { staffQuery } from '@/lib/convex/server'
import { GalleryManager, type AdminGalleryItem } from './GalleryManager'

export const metadata: Metadata = { title: 'Gallery' }

export default async function GalleryAdminPage() {
  if (!(await requirePageStaff(ADMIN_ONLY))) return <NotPermitted />
  const rows = await staffQuery(api.content.listGallery, {})
  const items: AdminGalleryItem[] = rows.map((r) => ({
    id: r._id,
    mediaType: r.mediaType,
    mediaPath: r.mediaPath,
    posterPath: r.posterPath ?? null,
    beforePath: r.beforePath ?? null,
    caption: r.caption ?? null,
    altText: r.altText,
    category: r.category,
    source: r.source,
    width: r.width ?? null,
    height: r.height ?? null,
    isFeatured: r.isFeatured,
    isPublished: r.isPublished,
    sortOrder: r.sortOrder,
    urls: { media: r.mediaUrl ?? null, poster: r.posterUrl ?? null, before: r.beforeUrl ?? null },
  }))
  return (
    <>
      <PageHeader
        title="Gallery"
        description="Real salon work first. Mark any stock or borrowed imagery as illustrative — it is labelled on the site. Before/after pairs must be genuine photos of the same client."
      />
      <GalleryManager items={items} />
    </>
  )
}
