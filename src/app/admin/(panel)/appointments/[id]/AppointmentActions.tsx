'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SlotPicker } from '@/components/admin/SlotPicker'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field'
import type { ActionResult } from '@/lib/auth/staff'
import { salonDate } from '@/lib/time'
import type { AppointmentStatus } from '@/lib/types'
import { rescheduleAppointment, setAppointmentStatus, updateAppointmentNotes } from '../actions'

type Props = {
  id: string
  status: AppointmentStatus
  started: boolean
  serviceId: string
  stylistId: string
  priceEtb: number
  internalNotes: string | null
  stylists: { id: string; name: string; serviceIds: string[] }[]
}

export function AppointmentActions({ id, status, started, serviceId, stylistId, priceEtb, internalNotes, stylists }: Props) {
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<'reject' | 'cancel' | 'complete' | 'reschedule' | null>(null)
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState(String(priceEtb))
  const [notes, setNotes] = useState(internalNotes ?? '')
  const [newStylist, setNewStylist] = useState(stylistId)
  const [date, setDate] = useState(salonDate())
  const [slot, setSlot] = useState<{ startsAt: string; stylistId: string | null } | null>(null)

  const run = (action: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        toast.success(result.message ?? 'Saved.')
        setDialog(null)
        after?.()
      } else {
        toast.error(result.error)
      }
    })

  const eligible = stylists.filter((s) => s.serviceIds.includes(serviceId))
  const names = Object.fromEntries(stylists.map((s) => [s.id, s.name]))
  const live = status === 'pending' || status === 'confirmed'

  return (
    <div className="space-y-6">
      {live && (
        <div className="flex flex-wrap gap-2">
          {status === 'pending' && (
            <>
              <Button variant="dark" disabled={pending} onClick={() => run(() => setAppointmentStatus({ id, status: 'confirmed' }))}>
                Confirm request
              </Button>
              <Button variant="outline-dark" disabled={pending} onClick={() => { setReason(''); setDialog('reject') }}>
                Decline
              </Button>
            </>
          )}
          {status === 'confirmed' && (
            <>
              <Button variant="dark" disabled={pending || !started} title={started ? undefined : 'Available once the appointment has started'} onClick={() => setDialog('complete')}>
                Complete &amp; record payment
              </Button>
              <Button variant="outline-dark" disabled={pending || !started} onClick={() => run(() => setAppointmentStatus({ id, status: 'no_show' }))}>
                No-show
              </Button>
              <Button variant="outline-dark" disabled={pending} onClick={() => { setReason(''); setDialog('cancel') }}>
                Cancel
              </Button>
            </>
          )}
          <Button variant="outline-dark" disabled={pending} onClick={() => { setSlot(null); setDialog('reschedule') }}>
            Reschedule
          </Button>
        </div>
      )}

      <div>
        <Field label="Internal notes" hint="Only visible to staff.">
          {({ id: fieldId, describedBy }) => (
            <TextArea id={fieldId} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} aria-describedby={describedBy} />
          )}
        </Field>
        <Button variant="outline-dark" size="sm" className="mt-2" disabled={pending || notes === (internalNotes ?? '')} onClick={() => run(() => updateAppointmentNotes(id, notes))}>
          Save notes
        </Button>
      </div>

      <Dialog open={dialog === 'reject' || dialog === 'cancel'} onClose={() => setDialog(null)} title={dialog === 'reject' ? 'Decline this request?' : 'Cancel this appointment?'} description="The client is notified if notifications are set up. A reason is required and recorded.">
        <Field label="Reason">
          {({ id: fieldId }) => <TextArea id={fieldId} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost-dark" onClick={() => setDialog(null)}>Back</Button>
          <Button variant="dark" disabled={pending || reason.trim().length < 3} onClick={() => run(() => setAppointmentStatus({ id, status: 'cancelled', reason }))}>
            {dialog === 'reject' ? 'Decline request' : 'Cancel appointment'}
          </Button>
        </div>
      </Dialog>

      <Dialog open={dialog === 'complete'} onClose={() => setDialog(null)} title="Complete appointment" description="Record what the client actually paid. This is what counts as recorded revenue.">
        <Field label="Amount paid (ETB)">
          {({ id: fieldId }) => <TextInput id={fieldId} type="number" inputMode="numeric" min={0} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost-dark" onClick={() => setDialog(null)}>Back</Button>
          <Button
            variant="dark"
            disabled={pending || !/^\d+$/.test(amount)}
            onClick={() => run(() => setAppointmentStatus({ id, status: 'completed', amountPaidEtb: Number(amount) }))}
          >
            Mark completed
          </Button>
        </div>
      </Dialog>

      <Dialog open={dialog === 'reschedule'} onClose={() => setDialog(null)} title="Reschedule" className="w-[min(44rem,calc(100vw-2rem))]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stylist">
            {({ id: fieldId }) => (
              <Select id={fieldId} value={newStylist} onChange={(e) => { setNewStylist(e.target.value); setSlot(null) }}>
                {eligible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Date">
            {({ id: fieldId }) => <TextInput id={fieldId} type="date" value={date} min={salonDate()} onChange={(e) => { setDate(e.target.value); setSlot(null) }} />}
          </Field>
        </div>
        <div className="mt-5">
          <SlotPicker serviceId={serviceId} stylistId={newStylist} date={date} ignoreId={id} value={slot} onChange={setSlot} stylistNames={names} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost-dark" onClick={() => setDialog(null)}>Back</Button>
          <Button
            variant="dark"
            disabled={pending || !slot}
            onClick={() => slot && run(() => rescheduleAppointment({ id, startsAt: slot.startsAt, stylistId: slot.stylistId ?? newStylist }))}
          >
            Move appointment
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
