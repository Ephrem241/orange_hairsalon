import type { Metadata } from 'next'
import Link from 'next/link'
import { Wordmark } from '@/components/site/Wordmark'
import { isConvexConfigured } from '@/lib/env'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Staff sign in' }

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="film-grain relative hidden overflow-hidden bg-charcoal lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop on a non-indexed page */}
        <img src="/images/gallery/copper-passion-twists.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/40 to-transparent" />
        <div className="absolute bottom-12 left-12 text-ivory">
          <Wordmark />
          <p className="mt-6 max-w-sm text-ivory/70">Appointments, schedules and salon settings — all in one place.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="lg:hidden" aria-label="Orange Salon — website">
            <Wordmark tone="dark" />
          </Link>
          <h1 className="mt-10 font-serif text-3xl lg:mt-0">Staff sign in</h1>
          <p className="mt-2 text-sm text-taupe-700">For Orange Salon team members only. Accounts are created by the owner.</p>
          <div className="mt-8">
            {isConvexConfigured ? (
              <LoginForm />
            ) : (
              <p className="rounded-sm border border-dashed border-gold-700/50 bg-white p-4 text-sm text-taupe-700">
                The dashboard needs a Convex deployment. Follow <strong>docs/SETUP.md</strong> to connect the database and create
                the first administrator.
              </p>
            )}
          </div>
          <Link href="/" className="mt-10 inline-block text-sm text-taupe-700 hover:text-charcoal">
            ← Back to the website
          </Link>
        </div>
      </div>
    </main>
  )
}
