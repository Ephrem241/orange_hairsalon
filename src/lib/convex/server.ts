import 'server-only'
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'
import { fetchAction, fetchMutation, fetchQuery } from 'convex/nextjs'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import { isConvexConfigured } from '@/lib/env'

/*
 * The three ways the Next.js server talks to Convex:
 *
 *   publicQuery  — published content, no credentials. Safe inside 'use cache'.
 *   server*      — the public booking API, rate limiting and notification
 *                  bookkeeping. Proves it is this server with CONVEX_SERVER_SECRET,
 *                  so browsers can never call those functions directly.
 *   staff*       — dashboard calls, carrying the signed-in staff member's Convex
 *                  Auth token. Convex checks the role on every call.
 */

const serverSecret = process.env.CONVEX_SERVER_SECRET ?? ''

/** True when server-only Convex functions can be called. */
export const isServerDataConfigured = Boolean(isConvexConfigured && serverSecret)

type WithSecret = { serverSecret: string }
type Secured<F extends FunctionReference<'query' | 'mutation'>> = Omit<FunctionArgs<F>, 'serverSecret'>

function requireConfigured() {
  if (!isServerDataConfigured) {
    throw new Error('Convex is not configured: set NEXT_PUBLIC_CONVEX_URL and CONVEX_SERVER_SECRET.')
  }
}

export async function publicQuery<F extends FunctionReference<'query'>>(fn: F, args: FunctionArgs<F>): Promise<FunctionReturnType<F>> {
  return await fetchQuery(fn, args)
}

export async function serverQuery<F extends FunctionReference<'query', 'public', WithSecret>>(
  fn: F,
  args: Secured<F>,
): Promise<FunctionReturnType<F>> {
  requireConfigured()
  // Callers are typed through F; the cast only erases the generic for Convex's argument tuple.
  return await fetchQuery(fn as FunctionReference<'query'>, { ...args, serverSecret })
}

export async function serverMutation<F extends FunctionReference<'mutation', 'public', WithSecret>>(
  fn: F,
  args: Secured<F>,
): Promise<FunctionReturnType<F>> {
  requireConfigured()
  return await fetchMutation(fn as FunctionReference<'mutation'>, { ...args, serverSecret })
}

export async function staffQuery<F extends FunctionReference<'query'>>(fn: F, args: FunctionArgs<F>): Promise<FunctionReturnType<F>> {
  return await fetchQuery(fn, args, { token: await convexAuthNextjsToken() })
}

export async function staffMutation<F extends FunctionReference<'mutation'>>(fn: F, args: FunctionArgs<F>): Promise<FunctionReturnType<F>> {
  return await fetchMutation(fn, args, { token: await convexAuthNextjsToken() })
}

export async function staffAction<F extends FunctionReference<'action'>>(fn: F, args: FunctionArgs<F>): Promise<FunctionReturnType<F>> {
  return await fetchAction(fn, args, { token: await convexAuthNextjsToken() })
}
