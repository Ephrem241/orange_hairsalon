'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/components/booking/useAvailability'
import { Button } from '@/components/ui/Button'
import { Field, Honeypot, TextArea, TextInput } from '@/components/ui/Field'
import { contactSchema, fieldErrors } from '@/lib/validation'

const empty = { fullName: '', phone: '', email: '', message: '', website: '' }

export function ContactForm() {
  const [values, setValues] = useState(empty)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const set = (patch: Partial<typeof empty>) => setValues((v) => ({ ...v, ...patch }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const parsed = contactSchema.safeParse(values)
    if (!parsed.success) {
      const found = fieldErrors(parsed.error)
      setErrors(found)
      document.getElementById(`contact-${Object.keys(found)[0]}`)?.focus()
      return
    }
    setErrors({})
    setState('sending')
    const result = await apiFetch('/api/contact', { method: 'POST', body: JSON.stringify(values) })
    if (result.error) {
      setState('idle')
      if (result.error.fields) setErrors(result.error.fields)
      setFormError(result.error.message)
      return
    }
    setState('sent')
    setValues(empty)
  }

  if (state === 'sent') {
    return (
      <div role="status" className="rounded-sm border border-emerald-700/20 bg-emerald-50 p-8">
        <CheckCircle2 aria-hidden className="size-8 text-emerald-700" />
        <h3 className="mt-4 font-serif text-2xl">Message sent</h3>
        <p className="mt-2 text-taupe-700">Thank you — our team will get back to you soon.</p>
        <Button variant="ghost-dark" className="mt-4 px-0" onClick={() => setState('idle')}>
          Send another message
        </Button>
      </div>
    )
  }

  return (
    <form noValidate onSubmit={submit} className="relative grid gap-5 sm:grid-cols-2">
      <Honeypot value={values.website} onChange={(website) => set({ website })} />
      <Field id="contact-fullName" label="Your name" error={errors.fullName} className="sm:col-span-2">
        {({ id, describedBy }) => (
          <TextInput id={id} autoComplete="name" value={values.fullName} error={errors.fullName} aria-describedby={describedBy} onChange={(e) => set({ fullName: e.target.value })} />
        )}
      </Field>
      <Field id="contact-phone" label="Phone" optional error={errors.phone}>
        {({ id, describedBy }) => (
          <TextInput id={id} type="tel" inputMode="tel" autoComplete="tel" value={values.phone} error={errors.phone} aria-describedby={describedBy} onChange={(e) => set({ phone: e.target.value })} />
        )}
      </Field>
      <Field id="contact-email" label="Email" optional error={errors.email}>
        {({ id, describedBy }) => (
          <TextInput id={id} type="email" autoComplete="email" value={values.email} error={errors.email} aria-describedby={describedBy} onChange={(e) => set({ email: e.target.value })} />
        )}
      </Field>
      <Field id="contact-message" label="Message" error={errors.message} className="sm:col-span-2" hint="Please don’t include payment details.">
        {({ id, describedBy }) => (
          <TextArea id={id} rows={5} maxLength={2000} value={values.message} error={errors.message} aria-describedby={describedBy} onChange={(e) => set({ message: e.target.value })} />
        )}
      </Field>
      {formError && (
        <p role="alert" className="rounded-sm bg-red-50 px-4 py-3 text-sm text-red-800 sm:col-span-2">
          {formError}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" arrow disabled={state === 'sending'} aria-busy={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send message'}
        </Button>
      </div>
    </form>
  )
}
