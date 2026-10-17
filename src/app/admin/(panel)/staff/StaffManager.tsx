'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Table, Td, Th } from '@/components/admin/ui'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Select, TextInput } from '@/components/ui/Field'
import type { StaffRole } from '@/lib/types'
import { createStaff, resetStaffPassword, updateStaff } from './actions'

type Member = { id: string; fullName: string; email: string | null; role: StaffRole; stylistId: string | null; isActive: boolean }
const ROLES: { value: StaffRole; label: string }[] = [
  { value: 'admin', label: 'Owner / admin' },
  { value: 'receptionist', label: 'Reception' },
  { value: 'stylist', label: 'Stylist' },
]

export function StaffManager({ meId, staff, stylists }: { meId: string; staff: Member[]; stylists: { id: string; name: string }[] }) {
  const [pending, start] = useTransition()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null)
  const [form, setForm] = useState({ email: '', fullName: '', role: 'receptionist' as StaffRole, stylistId: '' })
  const stylistName = Object.fromEntries(stylists.map((s) => [s.id, s.name]))

  return (
    <>
      <Button variant="dark" onClick={() => setCreating(true)}>+ Add staff member</Button>
      <Table className="mt-6">
        <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th /></tr></thead>
        <tbody>
          {staff.map((m) => (
            <tr key={m.id}>
              <Td className="font-medium">{m.fullName}{m.id === meId && <span className="ml-2 text-xs text-taupe-700">(you)</span>}</Td>
              <Td>{m.email ?? '—'}</Td>
              <Td>{ROLES.find((r) => r.value === m.role)?.label}{m.stylistId && <span className="block text-xs text-taupe-700">{stylistName[m.stylistId]}</span>}</Td>
              <Td>{m.isActive ? <span className="text-emerald-800">Active</span> : <span className="text-taupe-700">No access</span>}</Td>
              <Td className="text-right"><Button variant="outline-dark" size="sm" onClick={() => setEditing(m)}>Manage</Button></Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Add staff member" description="They’ll sign in with this email and a temporary password you share with them in person.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await createStaff({ ...form, stylistId: form.stylistId || null })
              if (!r.ok) return void toast.error(r.error)
              setCreating(false)
              setSecret({ email: form.email, password: r.data!.password })
              setForm({ email: '', fullName: '', role: 'receptionist', stylistId: '' })
            })
          }}
        >
          <Field label="Full name">{({ id }) => <TextInput id={id} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />}</Field>
          <Field label="Email">{({ id }) => <TextInput id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
          <Field label="Role">
            {({ id }) => (
              <Select id={id} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            )}
          </Field>
          {form.role === 'stylist' && (
            <Field label="Stylist profile">
              {({ id }) => (
                <Select id={id} value={form.stylistId} onChange={(e) => setForm({ ...form, stylistId: e.target.value })}>
                  <option value="">Choose…</option>
                  {stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              )}
            </Field>
          )}
          <div className="flex justify-end gap-2"><Button variant="ghost-dark" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit" variant="dark" disabled={pending}>Create account</Button></div>
        </form>
      </Dialog>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing ? `Manage ${editing.fullName}` : ''}>
        {editing && (
          <div className="space-y-4">
            <Field label="Full name">{({ id }) => <TextInput id={id} value={editing.fullName} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} />}</Field>
            <Field label="Role">
              {({ id }) => (
                <Select id={id} value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as StaffRole })}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
              )}
            </Field>
            {editing.role === 'stylist' && (
              <Field label="Stylist profile">
                {({ id }) => (
                  <Select id={id} value={editing.stylistId ?? ''} onChange={(e) => setEditing({ ...editing, stylistId: e.target.value || null })}>
                    <option value="">Choose…</option>
                    {stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                )}
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="size-4 accent-[#171513]" /> Dashboard access</label>
            {editing.id === meId && <p className="text-xs text-taupe-700">You can’t remove the last active admin — promote someone else first.</p>}
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <Button
                variant="outline-dark"
                size="sm"
                disabled={pending}
                onClick={() =>
                  confirm(`Reset ${editing.fullName}’s password?`) &&
                  start(async () => {
                    const r = await resetStaffPassword(editing.id)
                    if (!r.ok) return void toast.error(r.error)
                    setSecret({ email: editing.email ?? editing.fullName, password: r.data!.password })
                    setEditing(null)
                  })
                }
              >
                Reset password
              </Button>
              <Button
                variant="dark"
                disabled={pending}
                onClick={() => start(async () => { const r = await updateStaff(editing); if (r.ok) { toast.success(r.message); setEditing(null) } else toast.error(r.error) })}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={secret !== null} onClose={() => setSecret(null)} title="Temporary password" description="Share it privately. It is shown only once; they should change it under Account after signing in.">
        {secret && (
          <div className="space-y-3">
            <p className="text-sm">Email: <strong>{secret.email}</strong></p>
            <p className="rounded-sm bg-ivory-200 px-4 py-3 font-mono text-lg tracking-wider select-all">{secret.password}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline-dark" size="sm" onClick={() => navigator.clipboard.writeText(secret.password).then(() => toast.success('Copied.'))}>Copy</Button>
              <Button variant="dark" size="sm" onClick={() => setSecret(null)}>Done</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}
