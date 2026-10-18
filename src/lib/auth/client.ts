'use client'

/*
 * Staff sign-in and sign-out from the browser. Both go through /api/auth, which
 * src/proxy.ts forwards to Convex Auth; it keeps the session in httpOnly
 * cookies that page scripts can never read.
 */

async function authAction(action: 'auth:signIn' | 'auth:signOut', args: Record<string, unknown>) {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args }),
  })
  const body = (await response.json().catch(() => null)) as { tokens?: unknown; error?: string } | null
  return { ok: response.ok, body }
}

/** True when the email and password were accepted (the session cookies are now set). */
export async function signInWithPassword(email: string, password: string): Promise<boolean> {
  const { ok, body } = await authAction('auth:signIn', { provider: 'password', params: { email, password, flow: 'signIn' } })
  return ok && Boolean(body?.tokens)
}

export async function signOutOfDashboard(): Promise<void> {
  await authAction('auth:signOut', {})
}
