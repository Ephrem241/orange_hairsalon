import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { Toaster } from 'sonner'
import { siteUrl } from '@/config/site'
import './globals.css'

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Orange Salon — Hair Salon in Addis Ababa',
    template: '%s · Orange Salon, Addis Ababa',
  },
  description:
    'Orange Salon on Ednamoll Street, Addis Ababa: braids and protective styles, colour, cuts and styling. Book your appointment online.',
  applicationName: 'Orange Salon',
  openGraph: {
    type: 'website',
    siteName: 'Orange Salon',
    locale: 'en_ET',
  },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#171513',
  colorScheme: 'light',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // suppressHydrationWarning: the inline script adds the `js` class before React hydrates.
    <html lang="en" className={`${playfair.variable} ${inter.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: '!rounded-sm !border-charcoal-700 !bg-charcoal !text-ivory !font-sans',
              description: '!text-ivory/70',
            },
          }}
        />
      </body>
    </html>
  )
}
