import type { Metadata } from 'next'
import { Card, PageHeader } from '@/components/admin/ui'
import { requirePageStaff } from '@/lib/auth/staff'
import { PasswordForm } from './PasswordForm'

export const metadata: Metadata = { title: 'Account' }

export default async function AccountPage() {
  const staff = (await requirePageStaff())!
  return (
    <>
      <PageHeader title="Your account" description={`${staff.fullName} · ${staff.email ?? ''}`} />
      <Card title="Change password" className="max-w-lg">
        <PasswordForm />
      </Card>
    </>
  )
}
