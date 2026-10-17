import type { Metadata } from 'next'
import { EmptyState, NotPermitted, PageHeader } from '@/components/admin/ui'
import { FRONT_DESK, requirePageStaff } from '@/lib/auth/staff'
import { formatPhone, telHref } from '@/lib/format'
import { createSessionClient } from '@/lib/supabase/server'
import { formatDateShort, formatTime } from '@/lib/time'
import { MessageStatusButtons } from './MessageStatusButtons'

export const metadata: Metadata = { title: 'Messages' }

export default async function MessagesPage({ searchParams }: PageProps<'/admin/messages'>) {
  if (!(await requirePageStaff(FRONT_DESK))) return <NotPermitted />
  const { show } = await searchParams
  const archived = show === 'archived'
  const db = await createSessionClient()
  const query = db.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200)
  const { data } = archived ? await query.eq('status', 'archived') : await query.neq('status', 'archived')
  return (
    <>
      <PageHeader
        title="Messages"
        description="Sent from the website’s contact form."
        actions={<a href={archived ? '/admin/messages' : '/admin/messages?show=archived'} className="text-sm text-gold-700 hover:underline">{archived ? 'Show inbox' : 'Show archived'}</a>}
      />
      {(data ?? []).length === 0 ? (
        <EmptyState title={archived ? 'No archived messages' : 'Inbox is empty'} />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((m) => (
            <li key={m.id} className={`rounded-md border bg-white p-5 ${m.status === 'new' ? 'border-gold/60' : 'border-charcoal/10'}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{m.full_name} {m.status === 'new' && <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-xs text-gold-700">New</span>}</p>
                  <p className="text-xs text-taupe-700">
                    {m.phone && <a href={telHref(m.phone)} className="hover:text-charcoal">{formatPhone(m.phone)}</a>}
                    {m.phone && m.email && ' · '}
                    {m.email && <a href={`mailto:${m.email}`} className="hover:text-charcoal">{m.email}</a>}
                    {' · '}{formatDateShort(m.created_at)} {formatTime(m.created_at)}
                  </p>
                </div>
                <MessageStatusButtons id={m.id} status={m.status} />
              </div>
              <p className="mt-3 text-sm whitespace-pre-line">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
