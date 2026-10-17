'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Modal built on the native <dialog> element: focus is trapped and restored by
 * the browser, Escape closes it, and the rest of the page is inert.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // backdrop click
      }}
      aria-labelledby={titleId}
      className={cn(
        'm-auto w-[min(32rem,calc(100vw-2rem))] rounded-sm bg-white p-0 text-charcoal shadow-2xl backdrop:bg-charcoal/60 backdrop:backdrop-blur-[2px]',
        className,
      )}
    >
      {open && (
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-serif text-2xl">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 inline-flex size-9 items-center justify-center rounded-full text-taupe-700 hover:bg-ivory-200">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          {description && <div className="mt-2 text-sm text-taupe-700">{description}</div>}
          <div className="mt-6">{children}</div>
        </div>
      )}
    </dialog>
  )
}
