'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MediaUpload } from '@/components/admin/MediaUpload'
import { Button } from '@/components/ui/Button'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import type { AdminStylist } from '@/lib/admin/data'
import { saveStylist } from '../actions'

export function StylistProfileForm({ stylist, contact, nextSortOrder }: { stylist: AdminStylist | null; contact: { phone: string; email: string } | null; nextSortOrder: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [v, setV] = useState({
    displayName: stylist?.displayName ?? '',
    title: stylist?.title ?? '',
    bio: stylist?.bio ?? '',
    photoPath: stylist?.photoPath ?? null,
    isActive: stylist?.isActive ?? true,
    acceptsOnlineBooking: stylist?.acceptsOnlineBooking ?? true,
    sortOrder: String(stylist?.sortOrder ?? nextSortOrder),
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
  })
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }))

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await saveStylist({ id: stylist?.id ?? null, ...v, sortOrder: Number(v.sortOrder) || 0 })
          if (!r.ok) return void toast.error(r.error)
          toast.success(r.message)
          if (!stylist) router.push(`/admin/stylists/${r.data!.id}`)
        })
      }}
    >
      <MediaUpload folder="stylists" label="Portrait" value={v.photoPath} onChange={(m) => set({ photoPath: m?.path ?? null })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name">{({ id }) => <TextInput id={id} value={v.displayName} onChange={(e) => set({ displayName: e.target.value })} />}</Field>
        <Field label="Title" optional hint="e.g. Braids specialist">{({ id, describedBy }) => <TextInput id={id} value={v.title} aria-describedby={describedBy} onChange={(e) => set({ title: e.target.value })} />}</Field>
      </div>
      <Field label="Biography" optional hint="Shown on the About page. Only include verified experience.">
        {({ id, describedBy }) => <TextArea id={id} maxLength={2000} value={v.bio} aria-describedby={describedBy} onChange={(e) => set({ bio: e.target.value })} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" optional hint="Private — staff only.">{({ id, describedBy }) => <TextInput id={id} type="tel" value={v.phone} aria-describedby={describedBy} onChange={(e) => set({ phone: e.target.value })} />}</Field>
        <Field label="Email" optional hint="Private — staff only.">{({ id, describedBy }) => <TextInput id={id} type="email" value={v.email} aria-describedby={describedBy} onChange={(e) => set({ email: e.target.value })} />}</Field>
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="size-4 accent-[#171513]" /> Active</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={v.acceptsOnlineBooking} onChange={(e) => set({ acceptsOnlineBooking: e.target.checked })} className="size-4 accent-[#171513]" /> Bookable online</label>
        <label className="flex items-center gap-2">Order <input type="number" value={v.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} className="h-8 w-20 rounded-sm border border-charcoal/20 px-2" /></label>
      </div>
      <Button type="submit" variant="dark" disabled={pending}>{pending ? 'Saving…' : 'Save profile'}</Button>
    </form>
  )
}
