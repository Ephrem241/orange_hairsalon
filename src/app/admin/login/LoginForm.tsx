'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { signInWithPassword, signOutOfDashboard } from '@/lib/auth/client'
import { confirmStaffAccess, prepareSignIn } from './actions'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const fail = (message: string) => {
    setError(message)
    setPending(false)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim().toLowerCase()
    const password = String(form.get('password') ?? '')
    if (!password) return setError('Enter your password.')
    setPending(true)
    setError(null)
    try {
      const prepared = await prepareSignIn(email)
      if (prepared.error) return fail(prepared.error)
      if (!(await signInWithPassword(email, password))) return fail('Email or password is incorrect.')
      if (!(await confirmStaffAccess())) {
        await signOutOfDashboard()
        return fail('This account does not have dashboard access. Ask the salon owner.')
      }
      // A full page load, not router.replace: the client router may still hold the
      // redirect to this page that it prefetched for /admin while signed out.
      window.location.replace('/admin')
    } catch {
      fail('Something went wrong. Please try again.')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Email">
        {({ id }) => <TextInput id={id} name="email" type="email" autoComplete="username" required />}
      </Field>
      <Field label="Password">
        {({ id }) => <TextInput id={id} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      {error && (
        <p role="alert" className="rounded-sm bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <Button type="submit" variant="dark" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
