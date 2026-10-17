import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Keeps staff sessions fresh on dashboard routes and sends signed-out visitors
 * to the login page. This is an optimistic check only — every dashboard page,
 * server action and database query re-verifies the user and their role.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        for (const [header, value] of Object.entries(headers ?? {})) response.headers.set(header, value)
      },
    },
  })

  const { data } = await supabase.auth.getUser()
  const isLogin = request.nextUrl.pathname.startsWith('/admin/login')
  if (!data.user && !isLogin) {
    const login = request.nextUrl.clone()
    login.pathname = '/admin/login'
    login.search = ''
    return NextResponse.redirect(login)
  }
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
