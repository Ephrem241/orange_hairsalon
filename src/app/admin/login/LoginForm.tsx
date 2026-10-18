'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { signInWithPassword, signOutOfDashboard } from '@/lib/auth/client'
import { confirmStaffAccess, prepareSignIn } from './actions'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim().toLowerCase()
    const password = String(form.get('password') ?? '')
    setPending(true)
    setError(null)
    try {
      const prepared = await prepareSignIn(email, password)
      if (prepared.error) return setError(prepared.error)
      if (!(await signInWithPassword(email, password))) return setError('Email or password is incorrect.')
      if (!(await confirmStaffAccess())) {
        await signOutOfDashboard()
        return setError('This account does not have dashboard access. Ask the salon owner.')
      }
      router.replace('/admin')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
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
