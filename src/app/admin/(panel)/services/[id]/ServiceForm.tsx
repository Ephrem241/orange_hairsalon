'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MediaUpload } from '@/components/admin/MediaUpload'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field'
import type { AdminService } from '@/lib/admin/data'
import { formatDuration, formatEtb } from '@/lib/format'
import { deleteService, saveService } from '../actions'

export function ServiceForm({ service, categories, nextSortOrder }: { service: AdminService | null; categories: { id: string; name: string }[]; nextSortOrder: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [imageUrl, setImageUrl] = useState(service?.imageUrl ?? null)
  const [v, setV] = useState({
    name: service?.name ?? '',
    slug: service?.slug ?? '',
    categoryId: service?.categoryId ?? '',
    summary: service?.summary ?? '',
    description: service?.description ?? '',
    imagePath: service?.imagePath ?? null,
    priceEtb: service ? String(service.priceEtb) : '',
    priceType: service?.priceType ?? 'fixed',
    durationMin: service ? String(service.durationMin) : '60',
    bufferMin: service?.bufferMin === null || service?.bufferMin === undefined ? '' : String(service.bufferMin),
    isActive: service?.isActive ?? true,
    isFeatured: service?.isFeatured ?? false,
    sortOrder: String(service?.sortOrder ?? nextSortOrder),
  })
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }))
  const int = (s: string) => (s.trim() === '' ? NaN : Number(s))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    start(async () => {
      const result = await saveService({
        id: service?.id ?? null,
        name: v.name,
        slug: v.slug,
        categoryId: v.categoryId || null,
        summary: v.summary,
        description: v.description,
        imagePath: v.imagePath,
        priceEtb: int(v.priceEtb),
        priceType: v.priceType,
        durationMin: int(v.durationMin),
        bufferMin: v.bufferMin === '' ? null : int(v.bufferMin),
        isActive: v.isActive,
        isFeatured: v.isFeatured,
        sortOrder: int(v.sortOrder) || 0,
      })
      if (!result.ok) {
        setErrors(result.fields ?? {})
        toast.error(result.error)
        return
      }
      setErrors({})
      toast.success(result.message)
      if (!service) router.push(`/admin/services/${result.data!.id}`)
    })
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <section className="space-y-5 rounded-md border border-charcoal/10 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Service name" error={errors.name}>{({ id }) => <TextInput id={id} value={v.name} error={errors.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
          <Field label="Category" optional>
            {({ id }) => (
              <Select id={id} value={v.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Short summary" optional hint="One line shown on cards (max 200 characters).">
          {({ id, describedBy }) => <TextInput id={id} maxLength={200} value={v.summary} aria-describedby={describedBy} onChange={(e) => set({ summary: e.target.value })} />}
        </Field>
        <Field label="Description" optional>{({ id }) => <TextArea id={id} rows={6} maxLength={4000} value={v.description} onChange={(e) => set({ description: e.target.value })} />}</Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Price (ETB)" error={errors.priceEtb}>
            {({ id }) => <TextInput id={id} type="number" inputMode="numeric" min={0} step={1} value={v.priceEtb} error={errors.priceEtb} onChange={(e) => set({ priceEtb: e.target.value })} />}
          </Field>
          <Field label="Price type">
            {({ id }) => (
              <Select id={id} value={v.priceType} onChange={(e) => set({ priceType: e.target.value as 'fixed' | 'from' })}>
                <option value="fixed">Fixed</option>
                <option value="from">From (varies)</option>
              </Select>
            )}
          </Field>
          <Field label="Duration (min)" error={errors.durationMin}>
            {({ id }) => <TextInput id={id} type="number" inputMode="numeric" min={5} max={600} step={5} value={v.durationMin} error={errors.durationMin} onChange={(e) => set({ durationMin: e.target.value })} />}
          </Field>
          <Field label="Clean-up (min)" optional hint="Blank = salon default." error={errors.bufferMin}>
            {({ id, describedBy }) => <TextInput id={id} type="number" inputMode="numeric" min={0} max={120} step={5} value={v.bufferMin} aria-describedby={describedBy} onChange={(e) => set({ bufferMin: e.target.value })} />}
          </Field>
        </div>
        {Number.isFinite(int(v.priceEtb)) && Number.isFinite(int(v.durationMin)) && (
          <p className="text-sm text-taupe-700">Shown to clients as: <strong className="text-charcoal">{formatEtb(int(v.priceEtb), v.priceType)} · {formatDuration(int(v.durationMin))}</strong></p>
        )}
      </section>

      <aside className="space-y-5 rounded-md border border-charcoal/10 bg-white p-5">
        <MediaUpload
          value={v.imagePath}
          previewUrl={imageUrl}
          onChange={(m) => {
            set({ imagePath: m?.path ?? null })
            setImageUrl(m?.url ?? null)
          }}
        />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="mt-0.5 size-4 accent-[#171513]" />
          <span><strong className="font-medium">Bookable</strong><span className="block text-xs text-taupe-700">Visible on the site and in online booking.</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={v.isFeatured} onChange={(e) => set({ isFeatured: e.target.checked })} className="mt-0.5 size-4 accent-[#171513]" />
          <span><strong className="font-medium">Featured</strong><span className="block text-xs text-taupe-700">Shown first on the homepage.</span></span>
        </label>
        <Field label="Web address (slug)" optional hint="Leave blank to generate from the name.">
          {({ id, describedBy }) => <TextInput id={id} value={v.slug} aria-describedby={describedBy} onChange={(e) => set({ slug: e.target.value })} />}
        </Field>
        <Field label="Sort order">{({ id }) => <TextInput id={id} type="number" value={v.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} />}</Field>
        <div className="flex flex-wrap gap-2 border-t border-charcoal/10 pt-5">
          <Button type="submit" variant="dark" disabled={pending}>{pending ? 'Saving…' : 'Save service'}</Button>
          {service && (
            <Button
              variant="ghost-dark"
              disabled={pending}
              onClick={() =>
                confirm('Delete this service? Services with bookings can only be hidden.') &&
                start(async () => {
                  const r = await deleteService(service.id)
                  if (r.ok) {
                    toast.success(r.message)
                    router.push('/admin/services')
                  } else toast.error(r.error)
                })
              }
            >
              Delete
            </Button>
          )}
        </div>
      </aside>
    </form>
  )
}
