'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { retryNotificationAction } from './actions'

export function RetryButton({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await retryNotificationAction(id)
          if (r.ok) toast.success(r.message)
          else toast.error(r.error)
        })
      }
      className="rounded-sm border border-charcoal/20 px-2.5 py-1 text-xs hover:border-charcoal/50 disabled:opacity-50"
    >
      {pending ? 'Retrying…' : 'Retry'}
    </button>
  )
}
