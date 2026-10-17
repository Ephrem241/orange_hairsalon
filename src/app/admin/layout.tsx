import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s · Orange Salon Dashboard' },
  robots: { index: false, follow: false },
}

export default function AdminRootLayout({ children }: LayoutProps<'/admin'>) {
  return <div className="min-h-dvh bg-[#f6f3ee] text-charcoal">{children}</div>
}
