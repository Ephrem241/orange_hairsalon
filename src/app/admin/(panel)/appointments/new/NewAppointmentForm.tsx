'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SlotPicker } from '@/components/admin/SlotPicker'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field'
import { formatDuration, formatEtb } from '@/lib/format'
import { salonDate } from '@/lib/time'
import { createAppointment } from '../actions'

type Option = { id: string; name: string }

export function NewAppointmentForm({
  services,
  stylists,
}: {
  services: (Option & { priceEtb: number; priceType: 'fixed' | 'from'; durationMin: number })[]
  stylists: (Option & { serviceIds: string[] })[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [serviceId, setServiceId] = useState('')
  const [stylistId, setStylistId] = useState<string>('')
  const [date, setDate] = useState(salonDate())
  const [slot, setSlot] = useState<{ startsAt: string; stylistId: string | null } | null>(null)
  const [client, setClient] = useState({ fullName: '', phone: '', email: '', notes: '' })
  const [source, setSource] = useState<'phone' | 'walk_in'>('phone')
  const [confirm, setConfirm] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const service = services.find((s) => s.id === serviceId)
  const eligible = stylists.filter((s) => s.serviceIds.includes(serviceId))
  const names = Object.fromEntries(stylists.map((s) => [s.id, s.name]))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!slot) {
      toast.error('Choose a time.')
      return
    }
    start(async () => {
      const result = await createAppointment({
        serviceId,
        stylistId: slot.stylistId ?? (stylistId || null),
        startsAt: slot.startsAt,
        ...client,
        source,
        confirm,
      })
      if (!result.ok) {
        setErrors(result.fields ?? {})
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      router.push(`/admin/appointments/${result.data!.id}`)
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-2" noValidate>
      <section className="space-y-5 rounded-md border border-charcoal/10 bg-white p-5">
        <h2 className="text-sm font-semibold">Appointment</h2>
        <Field label="Service" error={errors.serviceId}>
          {({ id }) => (
            <Select id={id} value={serviceId} onChange={(e) => { setServiceId(e.target.value); setStylistId(''); setSlot(null) }} required>
              <option value="">Choose a service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {formatEtb(s.priceEtb, s.priceType)}, {formatDuration(s.durationMin)}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stylist">
            {({ id }) => (
              <Select id={id} value={stylistId} disabled={!service} onChange={(e) => { setStylistId(e.target.value); setSlot(null) }}>
                <option value="">Any available</option>
                {eligible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Date">
            {({ id }) => <TextInput id={id} type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlot(null) }} />}
          </Field>
        </div>
        <SlotPicker serviceId={serviceId || null} stylistId={stylistId || null} date={date} value={slot} onChange={setSlot} stylistNames={names} />
      </section>

      <section className="space-y-5 rounded-md border border-charcoal/10 bg-white p-5">
        <h2 className="text-sm font-semibold">Client</h2>
        <Field label="Full name" error={errors.fullName}>
          {({ id }) => <TextInput id={id} value={client.fullName} error={errors.fullName} onChange={(e) => setClient({ ...client, fullName: e.target.value })} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" error={errors.phone} hint="Existing clients are matched by phone.">
            {({ id, describedBy }) => <TextInput id={id} type="tel" value={client.phone} error={errors.phone} aria-describedby={describedBy} onChange={(e) => setClient({ ...client, phone: e.target.value })} />}
          </Field>
          <Field label="Email" optional>
            {({ id }) => <TextInput id={id} type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />}
          </Field>
        </div>
        <Field label="Notes" optional>
          {({ id }) => <TextArea id={id} value={client.notes} maxLength={1000} onChange={(e) => setClient({ ...client, notes: e.target.value })} />}
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Booked by</legend>
          <div className="flex gap-4 text-sm">
            {(['phone', 'walk_in'] as const).map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input type="radio" name="source" checked={source === s} onChange={() => setSource(s)} className="accent-[#171513]" />
                {s === 'phone' ? 'Phone' : 'Walk-in'}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="size-4 accent-[#171513]" />
          Confirm immediately
        </label>
        <Button type="submit" variant="dark" size="lg" disabled={pending || !serviceId || !slot} aria-busy={pending}>
          {pending ? 'Booking…' : 'Create appointment'}
        </Button>
      </section>
    </form>
  )
}
