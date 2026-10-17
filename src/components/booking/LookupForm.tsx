'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { fieldErrors, lookupSchema } from '@/lib/validation'
import { apiFetch } from './useAvailability'

/** Reference + phone verification. On success the server sets the access cookie and the page re-renders. */
export function LookupForm({ initialReference = '', redirectTo }: { initialReference?: string; redirectTo?: string }) {
  const router = useRouter()
  const [reference, setReference] = useState(initialReference)
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const parsed = lookupSchema.safeParse({ reference, phone })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    setPending(true)
    const result = await apiFetch<{ reference: string }>('/api/booking/lookup', { method: 'POST', body: JSON.stringify(parsed.data) })
    setPending(false)
    if (result.error) {
      if (result.error.fields) setErrors(result.error.fields)
      setFormError(result.error.message)
      return
    }
    if (redirectTo) router.push(redirectTo)
    router.refresh()
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <Field id="lookup-reference" label="Booking reference" hint="Shown on your confirmation, e.g. OS-7K4M2P." error={errors.reference}>
        {({ id, describedBy }) => (
          <TextInput
            id={id}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="OS-"
            className="font-mono tracking-[0.1em] uppercase"
            error={errors.reference}
            aria-describedby={describedBy}
          />
        )}
      </Field>
      <Field id="lookup-phone" label="Phone number used to book" error={errors.phone}>
        {({ id, describedBy }) => (
          <TextInput
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
            aria-describedby={describedBy}
          />
        )}
      </Field>
      {formError && (
        <p role="alert" className="rounded-sm bg-red-50 px-4 py-3 text-sm text-red-800">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full sm:w-auto">
        {pending ? 'Checking…' : 'Find my booking'}
      </Button>
    </form>
  )
}
