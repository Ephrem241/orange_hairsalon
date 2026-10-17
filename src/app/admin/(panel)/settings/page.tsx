import type { Metadata } from 'next'
import { Card, NotPermitted, PageHeader } from '@/components/admin/ui'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { mapHours, mapSettings } from '@/lib/data/mappers'
import { createSessionClient } from '@/lib/supabase/server'
import { TimeOffManager } from '../stylists/[id]/TimeOffManager'
import { BookingPolicyForm, BusinessForm, HoursForm, NotificationForm } from './SettingsForms'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  if (!(await requirePageStaff(ADMIN_ONLY))) return <NotPermitted />
  const db = await createSessionClient()
  const [{ data: s }, { data: hours }, { data: n }, { data: closures }] = await Promise.all([
    db.from('business_settings').select('*').eq('id', 1).single(),
    db.from('business_hours').select('*').order('weekday'),
    db.from('notification_settings').select('*').eq('id', 1).single(),
    db.from('time_off').select('id, starts_at, ends_at, reason').is('stylist_id', null).gte('ends_at', new Date().toISOString()).order('starts_at'),
  ])
  const settings = mapSettings(s!)
  const configured = {
    email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  }

  return (
    <>
      <PageHeader title="Settings" description="Everything the public site says about the salon comes from here. Currency is ETB and the time zone is Africa/Addis_Ababa." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Business details" className="xl:row-span-2"><BusinessForm settings={settings} /></Card>
        <Card title="Opening hours"><HoursForm hours={(hours ?? []).map(mapHours)} /></Card>
        <Card title="Salon closures & holidays">
          <TimeOffManager stylistId={null} entries={(closures ?? []).map((c) => ({ id: c.id, startsAt: c.starts_at, endsAt: c.ends_at, reason: c.reason }))} />
        </Card>
        <Card title="Online booking policy"><BookingPolicyForm settings={settings} /></Card>
        <Card title="Notifications">
          <NotificationForm
            configured={configured}
            values={{ emailEnabled: n?.email_enabled ?? true, whatsappEnabled: n?.whatsapp_enabled ?? false, remindersEnabled: n?.reminders_enabled ?? true, salonAlertEmail: n?.salon_alert_email ?? '' }}
          />
        </Card>
      </div>
    </>
  )
}
