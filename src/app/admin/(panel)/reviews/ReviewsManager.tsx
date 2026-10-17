'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/admin/ui'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field'
import { deleteReview, saveReview } from './actions'

type Review = {
  id: string | null
  authorName: string
  rating: number | null
  body: string
  source: 'google' | 'tripadvisor' | 'facebook' | 'instagram' | 'in_person' | 'other'
  sourceUrl: string
  reviewedOn: string
  isPublished: boolean
}

const SOURCES: Review['source'][] = ['google', 'tripadvisor', 'facebook', 'instagram', 'in_person', 'other']
const blank: Review = { id: null, authorName: '', rating: 5, body: '', source: 'google', sourceUrl: '', reviewedOn: '', isPublished: true }

export function ReviewsManager({ reviews }: { reviews: Review[] }) {
  const [draft, setDraft] = useState<Review | null>(null)
  const [pending, start] = useTransition()

  return (
    <>
      <Button variant="dark" onClick={() => setDraft({ ...blank })}>+ Add a verified review</Button>
      <div className="mt-6 space-y-3">
        {reviews.length === 0 && <EmptyState title="No reviews yet">Copy reviews from Google, Tripadvisor or Facebook with their link so visitors can verify them.</EmptyState>}
        {reviews.map((r) => (
          <div key={r.id} className="flex flex-col gap-3 rounded-md border border-charcoal/10 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {r.authorName} {r.rating && <span className="text-gold-700">{'★'.repeat(r.rating)}</span>}
                <span className="ml-2 text-xs font-normal text-taupe-700 capitalize">{r.source.replace('_', ' ')} · {r.isPublished ? 'Published' : 'Hidden'}</span>
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-taupe-700">{r.body}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline-dark" size="sm" onClick={() => setDraft(r)}>Edit</Button>
              <Button variant="ghost-dark" size="sm" disabled={pending} onClick={() => confirm('Delete this review?') && start(async () => { const x = await deleteReview(r.id!); if (x.ok) toast.success(x.message); else toast.error(x.error) })}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? 'Edit review' : 'Add review'}>
        {draft && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              start(async () => {
                const r = await saveReview(draft)
                if (r.ok) {
                  toast.success(r.message)
                  setDraft(null)
                } else toast.error(r.error)
              })
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reviewer name">{({ id }) => <TextInput id={id} value={draft.authorName} onChange={(e) => setDraft({ ...draft, authorName: e.target.value })} />}</Field>
              <Field label="Rating" optional>
                {({ id }) => (
                  <Select id={id} value={draft.rating ?? ''} onChange={(e) => setDraft({ ...draft, rating: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">No rating</option>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
                  </Select>
                )}
              </Field>
            </div>
            <Field label="Review text">{({ id }) => <TextArea id={id} value={draft.body} maxLength={2000} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />}</Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Source">
                {({ id }) => (
                  <Select id={id} value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as Review['source'] })}>
                    {SOURCES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Link" optional className="sm:col-span-2">{({ id }) => <TextInput id={id} type="url" placeholder="https://" value={draft.sourceUrl} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} />}</Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" optional>{({ id }) => <TextInput id={id} type="date" value={draft.reviewedOn} onChange={(e) => setDraft({ ...draft, reviewedOn: e.target.value })} />}</Field>
              <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={draft.isPublished} onChange={(e) => setDraft({ ...draft, isPublished: e.target.checked })} className="size-4 accent-[#171513]" /> Published</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost-dark" onClick={() => setDraft(null)}>Cancel</Button>
              <Button type="submit" variant="dark" disabled={pending}>Save</Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  )
}
