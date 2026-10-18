'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import { MediaUpload } from '@/components/admin/MediaUpload'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Select, TextInput } from '@/components/ui/Field'
import { GALLERY_CATEGORIES, galleryCategoryLabel } from '@/lib/gallery'
import { isConvexId } from '@/lib/validation'
import type { GalleryItem } from '@/lib/types'
import { deleteGalleryItem, reorderGallery, saveGalleryItem } from './actions'

/** Path fields hold stored references (saved as-is); `urls` are for display. */
export type AdminGalleryItem = GalleryItem & { urls: { media: string | null; poster: string | null; before: string | null } }

type Draft = Omit<AdminGalleryItem, 'id' | 'sortOrder'> & { id: string | null }

const blank: Draft = {
  id: null, mediaType: 'image', mediaPath: '', posterPath: null, beforePath: null, caption: '', altText: '', category: 'braids',
  source: 'salon', width: null, height: null, isFeatured: false, isPublished: true, urls: { media: null, poster: null, before: null },
}

export function GalleryManager({ items }: { items: AdminGalleryItem[] }) {
  const [pending, start] = useTransition()
  const [draft, setDraft] = useState<Draft | null>(null)

  const move = (index: number, delta: number) => {
    const ids = items.map((i) => i.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    start(async () => {
      const r = await reorderGallery(ids.filter(isConvexId))
      if (!r.ok) toast.error(r.error)
    })
  }

  const save = () =>
    draft &&
    start(async () => {
      const r = await saveGalleryItem({ ...draft, caption: draft.caption ?? '' }) // display-only `urls` are dropped by the schema
      if (r.ok) {
        toast.success(r.message)
        setDraft(null)
      } else toast.error(r.error)
    })

  return (
    <>
      <Button variant="dark" onClick={() => setDraft({ ...blank })}>+ Add photo or video</Button>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item, index) => (
          <li key={item.id} className="overflow-hidden rounded-md border border-charcoal/10 bg-white">
            <div className="relative aspect-[4/5] bg-ivory-200">
              {(item.mediaType === 'video' ? item.urls.poster : item.urls.media) && (
                <Image src={(item.mediaType === 'video' ? item.urls.poster : item.urls.media)!} alt={item.altText} fill sizes="(min-width: 1280px) 22vw, 45vw" className="object-cover" />
              )}
              <div className="absolute top-2 left-2 flex flex-wrap gap-1 text-[0.625rem] font-semibold tracking-wide uppercase">
                {!item.isPublished && <span className="rounded-sm bg-charcoal/80 px-1.5 py-0.5 text-ivory">Hidden</span>}
                {item.isFeatured && <span className="rounded-sm bg-gold px-1.5 py-0.5 text-charcoal">Featured</span>}
                {item.mediaType === 'video' && <span className="rounded-sm bg-charcoal/80 px-1.5 py-0.5 text-ivory">Video</span>}
                {item.beforePath && <span className="rounded-sm bg-charcoal/80 px-1.5 py-0.5 text-ivory">Before/after</span>}
                {item.source === 'illustrative' && <span className="rounded-sm bg-amber-200 px-1.5 py-0.5 text-amber-900">Illustrative</span>}
              </div>
            </div>
            <div className="space-y-1 p-3">
              <p className="truncate text-sm font-medium">{item.caption ?? 'Untitled'}</p>
              <p className="text-xs text-taupe-700">{galleryCategoryLabel(item.category)}</p>
              <div className="flex gap-1 pt-2">
                <IconButton label="Move earlier" disabled={pending || index === 0} onClick={() => move(index, -1)}><ArrowUp className="size-4" /></IconButton>
                <IconButton label="Move later" disabled={pending || index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown className="size-4" /></IconButton>
                <IconButton label="Edit" onClick={() => setDraft({ ...item })}><Pencil className="size-4" /></IconButton>
                <IconButton
                  label="Delete"
                  disabled={pending}
                  onClick={() => confirm('Remove this item from the gallery?') && start(async () => { const r = await deleteGalleryItem(item.id); if (r.ok) toast.success(r.message); else toast.error(r.error) })}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? 'Edit gallery item' : 'Add to gallery'} className="w-[min(40rem,calc(100vw-2rem))]">
        {draft && (
          <div className="space-y-4">
            {!draft.id && (
              <div className="flex gap-4 text-sm">
                {(['image', 'video'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2">
                    <input type="radio" checked={draft.mediaType === t} onChange={() => setDraft({ ...draft, mediaType: t, mediaPath: '', posterPath: null, beforePath: null, urls: { media: null, poster: null, before: null } })} className="accent-[#171513]" />
                    {t === 'image' ? 'Photo' : 'Video'}
                  </label>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <MediaUpload
                accept={draft.mediaType}
                label={draft.mediaType === 'image' ? 'Photo (after)' : 'Video (MP4/WebM, no sound needed)'}
                value={draft.mediaPath || null}
                previewUrl={draft.urls.media}
                onChange={(m) => setDraft({ ...draft, mediaPath: m?.path ?? '', urls: { ...draft.urls, media: m?.url ?? null }, width: m?.width ?? draft.width, height: m?.height ?? draft.height })}
              />
              {draft.mediaType === 'video' ? (
                <MediaUpload label="Poster image" value={draft.posterPath} previewUrl={draft.urls.poster} onChange={(m) => setDraft({ ...draft, posterPath: m?.path ?? null, urls: { ...draft.urls, poster: m?.url ?? null }, width: m?.width ?? draft.width, height: m?.height ?? draft.height })} />
              ) : (
                <MediaUpload label="Before photo (optional, same client)" value={draft.beforePath} previewUrl={draft.urls.before} onChange={(m) => setDraft({ ...draft, beforePath: m?.path ?? null, urls: { ...draft.urls, before: m?.url ?? null } })} />
              )}
            </div>
            <Field label="Alt text" hint="Describe what is in the picture.">
              {({ id, describedBy }) => <TextInput id={id} value={draft.altText} maxLength={300} aria-describedby={describedBy} onChange={(e) => setDraft({ ...draft, altText: e.target.value })} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Caption" optional>{({ id }) => <TextInput id={id} value={draft.caption ?? ''} maxLength={200} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} />}</Field>
              <Field label="Category">
                {({ id }) => (
                  <Select id={id} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                    {GALLERY_CATEGORIES.map((c) => <option key={c} value={c}>{galleryCategoryLabel(c)}</option>)}
                  </Select>
                )}
              </Field>
            </div>
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isPublished} onChange={(e) => setDraft({ ...draft, isPublished: e.target.checked })} className="size-4 accent-[#171513]" /> Published</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isFeatured} onChange={(e) => setDraft({ ...draft, isFeatured: e.target.checked })} className="size-4 accent-[#171513]" /> Featured on homepage</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.source === 'illustrative'} onChange={(e) => setDraft({ ...draft, source: e.target.checked ? 'illustrative' : 'salon' })} className="size-4 accent-[#171513]" /> Illustrative (not our client work)</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost-dark" onClick={() => setDraft(null)}>Cancel</Button>
              <Button variant="dark" disabled={pending || !draft.mediaPath} onClick={save}>{pending ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}

function IconButton({ label, children, ...props }: { label: string; children: React.ReactNode } & React.ComponentProps<'button'>) {
  return (
    <button type="button" aria-label={label} title={label} className="inline-flex size-8 items-center justify-center rounded-sm border border-charcoal/10 text-taupe-700 hover:border-charcoal/30 hover:text-charcoal disabled:opacity-40" {...props}>
      {children}
    </button>
  )
}
