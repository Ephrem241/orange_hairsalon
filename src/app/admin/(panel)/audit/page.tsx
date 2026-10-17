import type { Metadata } from 'next'
import { EmptyState, NotPermitted, PageHeader, Table, Td, Th } from '@/components/admin/ui'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { createSessionClient } from '@/lib/supabase/server'
import { formatDateShort, formatTime } from '@/lib/time'

export const metadata: Metadata = { title: 'Audit log' }

const IGNORED = new Set(['updated_at', 'created_at'])

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
  const db = await createSessionClient()
  const [{ data: events }, { data: people }] = await Promise.all([
    db.from('audit_events').select('id, actor_id, actor_role, action, entity, entity_id, before, after, created_at').order('created_at', { ascending: false }).limit(200),
    db.from('profiles').select('id, full_name'),
  ])
  const name = Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name]))
  return (
    <>
      <PageHeader title="Audit log" description="Changes to settings, the menu, the team, the gallery, reviews and staff access — recorded automatically by the database." />
      {(events ?? []).length === 0 ? (
        <EmptyState title="No changes recorded yet" />
      ) : (
        <Table>
          <thead><tr><Th>When</Th><Th>Who</Th><Th>What</Th><Th>Details</Th></tr></thead>
          <tbody>
            {(events ?? []).map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap">{formatDateShort(e.created_at)} {formatTime(e.created_at)}</Td>
                <Td>{e.actor_id ? (name[e.actor_id] ?? 'Former staff') : 'System / setup'}<span className="block text-xs text-taupe-700">{e.actor_role ?? ''}</span></Td>
                <Td className="capitalize">{e.action} {e.entity.replace(/_/g, ' ')}</Td>
                <Td className="max-w-xl text-xs break-words text-taupe-700">{e.action === 'update' ? changes(e.before, e.after) || '—' : e.entity_id}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}
