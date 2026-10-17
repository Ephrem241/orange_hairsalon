import { cn } from '@/lib/cn'
import { STATUS } from '@/lib/status'
import type { AppointmentStatus } from '@/lib/types'

export function StatusBadge({ status, audience = 'staff', className }: { status: AppointmentStatus; audience?: 'staff' | 'customer'; className?: string }) {
  const s = STATUS[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', s.className, className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {audience === 'customer' ? s.customerLabel : s.label}
    </span>
  )
}
