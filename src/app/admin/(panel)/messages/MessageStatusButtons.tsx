'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { setMessageStatus } from './actions'

export function MessageStatusButtons({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition()
  const set = (next: 'new' | 'read' | 'archived') =>
    start(async () => {
      const r = await setMessageStatus(id, next)
      if (!r.ok) toast.error(r.error)
    })
  return (
    <div className="flex shrink-0 gap-2 text-xs">
      {status === 'new' && <button disabled={pending} onClick={() => set('read')} className="rounded-sm border border-charcoal/20 px-2.5 py-1 hover:border-charcoal/50">Mark read</button>}
      {status !== 'archived' ? (
        <button disabled={pending} onClick={() => set('archived')} className="rounded-sm border border-charcoal/20 px-2.5 py-1 hover:border-charcoal/50">Archive</button>
      ) : (
        <button disabled={pending} onClick={() => set('read')} className="rounded-sm border border-charcoal/20 px-2.5 py-1 hover:border-charcoal/50">Restore</button>
      )}
    </div>
  )
}
