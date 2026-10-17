'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { signIn, type LoginState } from './actions'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, { error: null, email: '' })
  return (
    <form action={action} className="space-y-5">
      <Field label="Email">
        {({ id }) => <TextInput id={id} name="email" type="email" autoComplete="username" required defaultValue={state.email} />}
      </Field>
      <Field label="Password">
        {({ id }) => <TextInput id={id} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      {state.error && (
        <p role="alert" className="rounded-sm bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="dark" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
