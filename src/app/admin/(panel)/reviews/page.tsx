import type { Metadata } from 'next'
import { NotPermitted, PageHeader } from '@/components/admin/ui'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { createSessionClient } from '@/lib/supabase/server'
import { ReviewsManager } from './ReviewsManager'

export const metadata: Metadata = { title: 'Reviews' }

export default async function ReviewsPage() {
  if (!(await requirePageStaff(ADMIN_ONLY))) return <NotPermitted />
  const db = await createSessionClient()
  const { data } = await db.from('reviews').select('*').order('sort_order').order('created_at', { ascending: false })
  return (
    <>
      <PageHeader
        title="Reviews"
        description="Only add genuine reviews you can trace (e.g. copied from Google with its link). The homepage section stays hidden until at least one is published."
      />
      <ReviewsManager
        reviews={(data ?? []).map((r) => ({
          id: r.id, authorName: r.author_name, rating: r.rating, body: r.body, source: r.source,
          sourceUrl: r.source_url ?? '', reviewedOn: r.reviewed_on ?? '', isPublished: r.is_published,
        }))}
      />
    </>
  )
}
