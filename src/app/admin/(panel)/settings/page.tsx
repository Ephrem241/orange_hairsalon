import { api } from '@convex/_generated/api'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Card, NotPermitted, PageHeader } from '@/components/admin/ui'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { mapHours, mapSettings } from '@/lib/data/mappers'
import { upcomingTimeOff } from '@/lib/admin/data'
import { staffQuery } from '@/lib/convex/server'
import { TimeOffManager } from '../stylists/[id]/TimeOffManager'
import { BookingPolicyForm, BusinessForm, HoursForm, NotificationForm } from './SettingsForms'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  if (!(await requirePageStaff(ADMIN_ONLY))) return <NotPermitted />
  const [{ business, hours, notifications: n }, closures] = await Promise.all([
    staffQuery(api.settings.get, {}),
    upcomingTimeOff('salon'),
  ])
  // The settings document is created by `npx convex run seed:verified`.
  if (!business) notFound()
  const settings = mapSettings(business)
  const configured = {
    email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  }

  return (
    <>
      <PageHeader title="Settings" description="Everything the public site says about the salon comes from here. Currency is ETB and the time zone is Africa/Addis_Ababa." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Business details" className="xl:row-span-2"><BusinessForm settings={settings} /></Card>
        <Card title="Opening hours"><HoursForm hours={hours.map(mapHours)} /></Card>
        <Card title="Salon closures & holidays">
          <TimeOffManager stylistId={null} entries={closures} />
        </Card>
        <Card title="Online booking policy"><BookingPolicyForm settings={settings} /></Card>
        <Card title="Notifications">
          <NotificationForm
            configured={configured}
            values={{ emailEnabled: n?.emailEnabled ?? true, whatsappEnabled: n?.whatsappEnabled ?? false, remindersEnabled: n?.remindersEnabled ?? true, salonAlertEmail: n?.salonAlertEmail ?? '' }}
          />
        </Card>
      </div>
    </>
  )
}
