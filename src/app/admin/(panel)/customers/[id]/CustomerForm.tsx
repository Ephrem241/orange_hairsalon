'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { updateCustomer } from '../actions'

export function CustomerForm(props: { id: string; fullName: string; email: string; staffNotes: string }) {
  const [values, setValues] = useState(props)
  const [pending, start] = useTransition()
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await updateCustomer(values)
          if (r.ok) toast.success(r.message)
          else toast.error(r.error)
        })
      }}
    >
      <Field label="Name">{({ id }) => <TextInput id={id} value={values.fullName} onChange={(e) => setValues({ ...values, fullName: e.target.value })} />}</Field>
      <Field label="Email" optional>{({ id }) => <TextInput id={id} type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} />}</Field>
      <Field label="Staff notes" optional hint="Preferences, allergies, patch tests…">
        {({ id, describedBy }) => <TextArea id={id} value={values.staffNotes} maxLength={2000} aria-describedby={describedBy} onChange={(e) => setValues({ ...values, staffNotes: e.target.value })} />}
      </Field>
      <Button type="submit" variant="dark" size="sm" disabled={pending}>Save</Button>
    </form>
  )
}
