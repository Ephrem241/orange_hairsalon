import { api } from '@convex/_generated/api'
import type { Metadata } from 'next'
import { EmptyState, NotPermitted, PageHeader, Table, Td, Th } from '@/components/admin/ui'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { staffQuery } from '@/lib/convex/server'
import { formatDateShort, formatTime } from '@/lib/time'

export const metadata: Metadata = { title: 'Audit log' }

const IGNORED = new Set(['_id', '_creationTime', 'updatedAt'])

/** "businessSettings" → "business settings" */
const words = (entity: string) => entity.replace(/([A-Z])/g, ' $1').toLowerCase()

/** Field-level summary of what changed in an update. */
function changes(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string {
  if (!before || !after) return ''
  return Object.keys(after)
    .filter((k) => !IGNORED.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => `${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`)
    .join('; ')
}

export default async function AuditPage() {
  if (!(await requirePageStaff(ADMIN_ONLY))) return <NotPermitted />
  const events = await staffQuery(api.audit.list, {})
  return (
    <>
      <PageHeader title="Audit log" description="Changes to settings, the menu, the team, the gallery, reviews and staff access — recorded automatically with every change." />
      {events.length === 0 ? (
        <EmptyState title="No changes recorded yet" />
      ) : (
        <Table>
          <thead><tr><Th>When</Th><Th>Who</Th><Th>What</Th><Th>Details</Th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e._id}>
                <Td className="whitespace-nowrap">{formatDateShort(new Date(e._creationTime))} {formatTime(new Date(e._creationTime))}</Td>
                <Td>{e.actorId ? (e.actorName ?? 'Former staff') : 'System / setup'}<span className="block text-xs text-taupe-700">{e.actorRole ?? ''}</span></Td>
                <Td className="capitalize">{e.action} {words(e.entity)}</Td>
                <Td className="max-w-xl text-xs break-words text-taupe-700">{e.action === 'update' ? changes(e.before ?? null, e.after ?? null) || '—' : e.entityId}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}
