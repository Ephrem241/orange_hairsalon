import { api } from '@convex/_generated/api'
import type { Metadata } from 'next'
import { NotPermitted, PageHeader } from '@/components/admin/ui'
import { listStylists } from '@/lib/admin/data'
import { ADMIN_ONLY, requirePageStaff } from '@/lib/auth/staff'
import { staffQuery } from '@/lib/convex/server'
import { StaffManager } from './StaffManager'

export const metadata: Metadata = { title: 'Staff & access' }

export default async function StaffPage() {
  const me = await requirePageStaff(ADMIN_ONLY)
  if (!me) return <NotPermitted />
  const [profiles, stylists] = await Promise.all([staffQuery(api.staff.list, {}), listStylists()])
  return (
    <>
      <PageHeader
        title="Staff & access"
        description="Owner/admin: everything. Reception: appointments, clients and messages. Stylist: their own diary and schedule. Permissions are enforced by the backend, not just this screen."
      />
      <StaffManager
        meId={me.profileId}
        staff={profiles.map((p) => ({ id: p._id, fullName: p.fullName, email: p.email, role: p.role, stylistId: p.stylistId ?? null, isActive: p.isActive }))}
        stylists={stylists.map((s) => ({ id: s.id, name: s.displayName }))}
      />
    </>
  )
}
