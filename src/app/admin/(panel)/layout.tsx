import { Suspense } from 'react'
import { AdminNav } from '@/components/admin/AdminNav'
import { requirePageStaff } from '@/lib/auth/staff'

// The dashboard is per-user and always rendered at request time.
export const instant = false

export default function PanelLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Frame>{children}</Frame>
    </Suspense>
  )
}

async function Frame({ children }: { children: React.ReactNode }) {
  const staff = await requirePageStaff()
  return (
    <>
      <AdminNav role={staff!.role} name={staff!.fullName} />
      <main id="main" className="lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </>
  )
}

function ShellSkeleton() {
  return (
    <div className="lg:pl-60">
      <div className="fixed inset-y-0 left-0 hidden w-60 bg-charcoal lg:block" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-10">
        <div className="h-9 w-56 animate-pulse rounded-sm bg-charcoal/10" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-md bg-charcoal/5" />
          ))}
        </div>
      </div>
    </div>
  )
}
