import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import { getBusinessHours, getServices, getSettings } from '@/lib/data/public'
import { jsonLdString, salonJsonLd } from '@/lib/seo'

export default async function SiteLayout({ children }: LayoutProps<'/'>) {
  const [settings, hours, services] = await Promise.all([getSettings(), getBusinessHours(), getServices()])
  return (
    <>
      <Header phone={settings.phone} />
      <main id="main">{children}</main>
      <Footer settings={settings} hours={hours} services={services} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(salonJsonLd(settings, hours)) }} />
    </>
  )
}
