'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field'
import type { ActionResult } from '@/lib/auth/staff'
import { WEEKDAYS } from '@/lib/time'
import type { BusinessHours, BusinessSettings } from '@/lib/types'
import { saveBookingPolicy, saveBusinessHours, saveBusinessSettings, saveNotificationSettings } from './actions'

function useSave() {
  const [pending, start] = useTransition()
  const save = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn()
      if (r.ok) toast.success(r.message ?? 'Saved.')
      else toast.error(r.error)
    })
  return { pending, save }
}

function Check({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[#171513]" />
      <span>
        {label}
        {hint && <span className="block text-xs text-taupe-700">{hint}</span>}
      </span>
    </label>
  )
}

export function BusinessForm({ settings: s }: { settings: BusinessSettings }) {
  const { pending, save } = useSave()
  const [v, setV] = useState({
    name: s.name, tagline: s.tagline ?? '', phone: s.phone ?? '', whatsapp: s.whatsapp ?? '', email: s.email ?? '',
    addressLine: s.addressLine ?? '', city: s.city, mapUrl: s.mapUrl ?? '',
    latitude: s.latitude?.toString() ?? '', longitude: s.longitude?.toString() ?? '',
    socials: { instagram: s.socials.instagram ?? '', facebook: s.socials.facebook ?? '', tiktok: s.socials.tiktok ?? '', youtube: s.socials.youtube ?? '', telegram: s.socials.telegram ?? '' },
    aboutStory: s.aboutStory ?? '',
  })
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }))
  const text = (key: keyof typeof v, label: string, opts: { optional?: boolean; hint?: string; type?: string } = {}) => (
    <Field label={label} optional={opts.optional} hint={opts.hint}>
      {({ id, describedBy }) => <TextInput id={id} type={opts.type} value={v[key] as string} aria-describedby={describedBy} onChange={(e) => set({ [key]: e.target.value } as Partial<typeof v>)} />}
    </Field>
  )
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(() => saveBusinessSettings(v)) }}>
      <div className="grid gap-4 sm:grid-cols-2">
        {text('name', 'Salon name')}
        {text('tagline', 'Tagline', { optional: true })}
        {text('phone', 'Phone', { hint: 'Shown on every page.', type: 'tel' })}
        {text('whatsapp', 'WhatsApp number', { optional: true, hint: 'Only shown once entered.', type: 'tel' })}
        {text('email', 'Public email', { optional: true, type: 'email' })}
        {text('addressLine', 'Street address')}
        {text('city', 'City')}
        {text('mapUrl', 'Google Maps link', { optional: true, hint: 'Used for “Get directions”.' })}
        {text('latitude', 'Latitude', { optional: true, hint: 'Only if verified, e.g. 8.9956' })}
        {text('longitude', 'Longitude', { optional: true, hint: 'e.g. 38.7837' })}
      </div>
      <fieldset className="grid gap-4 rounded-sm border border-charcoal/10 p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">Social links (shown only when filled)</legend>
        {(Object.keys(v.socials) as (keyof typeof v.socials)[]).map((k) => (
          <Field key={k} label={k[0].toUpperCase() + k.slice(1)} optional>
            {({ id }) => <TextInput id={id} placeholder="https://" value={v.socials[k]} onChange={(e) => set({ socials: { ...v.socials, [k]: e.target.value } })} />}
          </Field>
        ))}
      </fieldset>
      <Field label="Our story" optional hint="Shown on the About page. Only include verified history.">
        {({ id, describedBy }) => <TextArea id={id} rows={5} value={v.aboutStory} aria-describedby={describedBy} onChange={(e) => set({ aboutStory: e.target.value })} />}
      </Field>
      <Button type="submit" variant="dark" disabled={pending}>Save details</Button>
    </form>
  )
}

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]

export function HoursForm({ hours }: { hours: BusinessHours[] }) {
  const { pending, save } = useSave()
  const [rows, setRows] = useState(() =>
    MONDAY_FIRST.map((weekday) => {
      const h = hours.find((x) => x.weekday === weekday)
      return { weekday, isClosed: h?.isClosed ?? false, opensAt: h?.opensAt ?? '08:00', closesAt: h?.closesAt ?? '20:00' }
    }),
  )
  const update = (weekday: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x) => (x.weekday === weekday ? { ...x, ...patch } : x)))
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(() => saveBusinessHours(rows)) }}>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.weekday} className="border-b border-charcoal/5">
              <td className="py-2 pr-3 font-medium">{WEEKDAYS[r.weekday]}</td>
              <td className="py-2 pr-3"><label className="flex items-center gap-2"><input type="checkbox" checked={!r.isClosed} onChange={(e) => update(r.weekday, { isClosed: !e.target.checked })} className="size-4 accent-[#171513]" /> Open</label></td>
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <input type="time" aria-label={`${WEEKDAYS[r.weekday]} opens`} disabled={r.isClosed} value={r.opensAt} onChange={(e) => update(r.weekday, { opensAt: e.target.value })} className="h-9 rounded-sm border border-charcoal/20 px-2 disabled:bg-ivory-200" />
                  –
                  <input type="time" aria-label={`${WEEKDAYS[r.weekday]} closes`} disabled={r.isClosed} value={r.closesAt} onChange={(e) => update(r.weekday, { closesAt: e.target.value })} className="h-9 rounded-sm border border-charcoal/20 px-2 disabled:bg-ivory-200" />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button type="submit" variant="dark" className="mt-4" disabled={pending}>Save hours</Button>
    </form>
  )
}

export function BookingPolicyForm({ settings: s }: { settings: BusinessSettings }) {
  const { pending, save } = useSave()
  const [v, setV] = useState({
    onlineBookingEnabled: s.onlineBookingEnabled, autoConfirm: s.autoConfirm, requireEmail: s.requireEmail,
    allowCustomerCancel: s.allowCustomerCancel, allowCustomerReschedule: s.allowCustomerReschedule,
    minLeadMinutes: String(s.minLeadMinutes), maxAdvanceDays: String(s.maxAdvanceDays), slotIntervalMin: String(s.slotIntervalMin),
    defaultBufferMin: String(s.defaultBufferMin), cancelCutoffHours: String(s.cancelCutoffHours), policyText: s.policyText ?? '',
  })
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }))
  const num = (key: 'minLeadMinutes' | 'maxAdvanceDays' | 'defaultBufferMin' | 'cancelCutoffHours', label: string, hint: string) => (
    <Field label={label} hint={hint}>
      {({ id, describedBy }) => <TextInput id={id} type="number" min={0} value={v[key]} aria-describedby={describedBy} onChange={(e) => set({ [key]: e.target.value } as Partial<typeof v>)} />}
    </Field>
  )
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save(() =>
          saveBookingPolicy({
            ...v,
            minLeadMinutes: Number(v.minLeadMinutes), maxAdvanceDays: Number(v.maxAdvanceDays),
            slotIntervalMin: Number(v.slotIntervalMin) as 15, defaultBufferMin: Number(v.defaultBufferMin), cancelCutoffHours: Number(v.cancelCutoffHours),
          }),
        )
      }}
    >
      <div className="space-y-2">
        <Check label="Online booking open" hint="Switch off to pause the booking page (existing appointments are unaffected)." checked={v.onlineBookingEnabled} onChange={(x) => set({ onlineBookingEnabled: x })} />
        <Check label="Confirm online bookings automatically" hint="Off: bookings arrive as requests for staff to confirm." checked={v.autoConfirm} onChange={(x) => set({ autoConfirm: x })} />
        <Check label="Require an email address" checked={v.requireEmail} onChange={(x) => set({ requireEmail: x })} />
        <Check label="Clients may cancel online" checked={v.allowCustomerCancel} onChange={(x) => set({ allowCustomerCancel: x })} />
        <Check label="Clients may reschedule online" checked={v.allowCustomerReschedule} onChange={(x) => set({ allowCustomerReschedule: x })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {num('minLeadMinutes', 'Minimum notice (minutes)', 'e.g. 120 = 2 hours ahead')}
        {num('maxAdvanceDays', 'Booking window (days)', 'How far ahead clients can book')}
        {num('defaultBufferMin', 'Default clean-up (minutes)', 'Used when a service has none')}
        {num('cancelCutoffHours', 'Change cutoff (hours)', 'Online changes close this long before')}
        <Field label="Slot spacing">
          {({ id }) => (
            <Select id={id} value={v.slotIntervalMin} onChange={(e) => set({ slotIntervalMin: e.target.value })}>
              {[5, 10, 15, 20, 30, 60].map((m) => <option key={m} value={m}>Every {m} minutes</option>)}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Booking policy text" hint="Shown before clients confirm a booking.">
        {({ id, describedBy }) => <TextArea id={id} rows={5} value={v.policyText} aria-describedby={describedBy} onChange={(e) => set({ policyText: e.target.value })} />}
      </Field>
      <Button type="submit" variant="dark" disabled={pending}>Save policy</Button>
    </form>
  )
}

export function NotificationForm({ values, configured }: { values: { emailEnabled: boolean; whatsappEnabled: boolean; remindersEnabled: boolean; salonAlertEmail: string }; configured: { email: boolean; whatsapp: boolean } }) {
  const { pending, save } = useSave()
  const [v, setV] = useState(values)
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(() => saveNotificationSettings(v)) }}>
      <ul className="space-y-1 rounded-sm bg-ivory-200/60 p-3 text-xs text-taupe-700">
        <li>Email provider (Resend): <strong className={configured.email ? 'text-emerald-800' : 'text-red-800'}>{configured.email ? 'connected' : 'not set up'}</strong></li>
        <li>WhatsApp Business: <strong className={configured.whatsapp ? 'text-emerald-800' : 'text-red-800'}>{configured.whatsapp ? 'connected' : 'not set up'}</strong></li>
        <li>Messages to channels that aren’t set up are logged as “skipped”, never as sent.</li>
      </ul>
      <Check label="Email clients" hint="Requests, confirmations, changes and cancellations." checked={v.emailEnabled} onChange={(x) => setV({ ...v, emailEnabled: x })} />
      <Check label="WhatsApp clients" hint="Uses approved WhatsApp Business templates." checked={v.whatsappEnabled} onChange={(x) => setV({ ...v, whatsappEnabled: x })} />
      <Check label="Send reminders the day before" checked={v.remindersEnabled} onChange={(x) => setV({ ...v, remindersEnabled: x })} />
      <Field label="Alert the salon at" optional hint="New booking requests are emailed here.">
        {({ id, describedBy }) => <TextInput id={id} type="email" value={v.salonAlertEmail} aria-describedby={describedBy} onChange={(e) => setV({ ...v, salonAlertEmail: e.target.value })} />}
      </Field>
      <Button type="submit" variant="dark" disabled={pending}>Save notifications</Button>
    </form>
  )
}
