import { api } from '@convex/_generated/api'
import type { Metadata } from 'next'
import { NotPermitted, PageHeader } from '@/components/admin/ui'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { staffQuery } from '@/lib/convex/server'
import { ReviewsManager } from './ReviewsManager'

export const metadata: Metadata = { title: 'Reviews' }

export default async function ReviewsPage() {
  if (!(await requirePageStaff(ADMIN_ONLY))) return <NotPermitted />
  const reviews = await staffQuery(api.content.listReviews, {})
  return (
    <>
      <PageHeader
        title="Reviews"
        description="Only add genuine reviews you can trace (e.g. copied from Google with its link). The homepage section stays hidden until at least one is published."
      />
      <ReviewsManager
        reviews={reviews.map((r) => ({
          id: r._id, authorName: r.authorName, rating: r.rating ?? null, body: r.body, source: r.source,
          sourceUrl: r.sourceUrl ?? '', reviewedOn: r.reviewedOn ?? '', isPublished: r.isPublished,
        }))}
      />
    </>
  )
}
