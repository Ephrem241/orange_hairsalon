'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { changePassword } from './actions'

export function PasswordForm() {
  const [pending, start] = useTransition()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (password !== confirmation) return void toast.error('The passwords don’t match.')
        start(async () => {
          const r = await changePassword(password)
          if (r.ok) {
            toast.success(r.message)
            setPassword('')
            setConfirmation('')
          } else toast.error(r.error)
        })
      }}
    >
      <Field label="New password" hint="At least 12 characters.">
        {({ id, describedBy }) => <TextInput id={id} type="password" autoComplete="new-password" minLength={12} value={password} aria-describedby={describedBy} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Field label="Repeat new password">
        {({ id }) => <TextInput id={id} type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />}
      </Field>
      <Button type="submit" variant="dark" disabled={pending || password.length < 12}>Update password</Button>
    </form>
  )
}
