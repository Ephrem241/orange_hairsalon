import type { Metadata } from 'next'
import { NotPermitted, PageHeader } from '@/components/admin/ui'
import { listStylists } from '@/lib/admin/data'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { createSessionClient } from '@/lib/supabase/server'
import { StaffManager } from './StaffManager'

export const metadata: Metadata = { title: 'Staff & access' }

export default async function StaffPage() {
  const me = await requirePageStaff(ADMIN_ONLY)
  if (!me) return <NotPermitted />
  const db = await createSessionClient()
  const [{ data }, stylists] = await Promise.all([
    db.from('profiles').select('id, full_name, email, role, stylist_id, is_active, created_at').order('created_at'),
    listStylists(),
  ])
  return (
    <>
      <PageHeader
        title="Staff & access"
        description="Owner/admin: everything. Reception: appointments, clients and messages. Stylist: their own diary and schedule. Permissions are enforced by the database, not just this screen."
      />
      <StaffManager
        meId={me.id}
        staff={(data ?? []).map((p) => ({ id: p.id, fullName: p.full_name, email: p.email, role: p.role, stylistId: p.stylist_id, isActive: p.is_active }))}
        stylists={stylists.map((s) => ({ id: s.id, name: s.displayName }))}
      />
    </>
  )
}
