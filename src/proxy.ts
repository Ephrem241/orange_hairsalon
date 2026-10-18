import { convexAuthNextjsMiddleware, createRouteMatcher, nextjsMiddlewareRedirect } from '@convex-dev/auth/nextjs/server'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'

const isLoginPage = createRouteMatcher(['/admin/login'])

/**
 * Convex Auth for the dashboard: handles sign-in/sign-out posted to /api/auth,
 * keeps staff sessions fresh, and sends signed-out visitors to the login page.
 * This is an optimistic check only — every dashboard page, server action and
 * Convex function re-verifies the user and their role.
 */
const withConvexAuth = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (!isLoginPage(request) && !(await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, '/admin/login')
    }
  },
  // Keep staff signed in across browser restarts for as long as the session lasts (30 days).
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
)

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return NextResponse.next()
  return withConvexAuth(request, event)
}

export const config = {
  matcher: ['/admin/:path*', '/api/auth'],
}
