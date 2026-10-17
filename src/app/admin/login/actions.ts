'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { allowRequest, clientIp } from '@/lib/security/rate-limit'
import { createSessionClient } from '@/lib/supabase/server'

export type LoginState = { error: string | null; email: string }

const credentials = z.object({
  email: z.email('Enter your email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const parsed = credentials.safeParse({ email, password: formData.get('password') })
  if (!parsed.success) return { error: parsed.error.issues[0].message, email }

  if (!(await allowRequest('login:ip', clientIp(await headers()), 10, 900))) {
    return { error: 'Too many sign-in attempts. Please wait 15 minutes.', email }
  }

  const supabase = await createSessionClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error || !data.user) return { error: 'Email or password is incorrect.', email }

  // A valid Supabase account is not enough: it must be an active staff profile.
  const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', data.user.id).maybeSingle()
  if (!profile?.is_active) {
    await supabase.auth.signOut()
    return { error: 'This account does not have dashboard access. Ask the salon owner.', email }
  }
  redirect('/admin')
}

export async function signOut() {
  const supabase = await createSessionClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
