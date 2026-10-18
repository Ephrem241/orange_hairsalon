import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import type { Metadata } from 'next'
import { Card, EmptyState, PageHeader } from '@/components/admin/ui'
import { requirePageStaff } from '@/lib/auth/staff'
import { upcomingTimeOff } from '@/lib/admin/data'
import { staffQuery } from '@/lib/convex/server'
import { formatDateShort, formatTime, WEEKDAYS } from '@/lib/time'

export const metadata: Metadata = { title: 'My schedule' }

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]

/** A stylist's own weekly hours, breaks and time off (read-only; the owner edits them). */
export default async function SchedulePage() {
  const staff = (await requirePageStaff())!
  if (!staff.stylistId) return <EmptyState title="No stylist profile linked">Ask the salon owner to link your login to your stylist profile.</EmptyState>
  // A stylist sees their own time off plus salon-wide closures.
  const [detail, off] = await Promise.all([staffQuery(api.stylists.detail, { id: staff.stylistId as Id<'stylists'> }), upcomingTimeOff()])
  const hours = detail?.hours ?? []
  const breaks = detail?.breaks ?? []
  return (
    <>
      <PageHeader title="My schedule" description="Your weekly hours and upcoming time off. Ask the owner or reception to make changes." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Weekly hours" padded={false}>
          <ul className="divide-y divide-charcoal/5 text-sm">
            {MONDAY_FIRST.map((d) => {
              const work = hours.filter((h) => h.weekday === d)
              const rest = breaks.filter((b) => b.weekday === d)
              return (
                <li key={d} className="flex justify-between gap-4 px-5 py-3">
                  <span className="font-medium">{WEEKDAYS[d]}</span>
                  <span className="text-right">
                    {work.length ? work.map((h) => `${h.startsAt}–${h.endsAt}`).join(', ') : <span className="text-taupe-700">Off</span>}
                    {rest.length > 0 && <span className="block text-xs text-taupe-700">Breaks: {rest.map((b) => `${b.startsAt}–${b.endsAt}`).join(', ')}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card title="Upcoming time off & closures" padded={false}>
          {off.length === 0 ? (
            <p className="p-5 text-sm text-taupe-700">Nothing scheduled.</p>
          ) : (
            <ul className="divide-y divide-charcoal/5 text-sm">
              {off.map((o) => (
                <li key={o.id} className="px-5 py-3">
                  {formatDateShort(o.startsAt)} {formatTime(o.startsAt)} → {formatDateShort(o.endsAt)} {formatTime(o.endsAt)}
                  <span className="block text-xs text-taupe-700">{o.stylistId ? (o.reason ?? 'Time off') : `Salon closed${o.reason ? ` — ${o.reason}` : ''}`}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
