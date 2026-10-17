import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'light' | 'dark'

const inputBase =
  'block w-full rounded-sm border bg-white px-3.5 py-3 text-[0.9375rem] text-charcoal placeholder:text-taupe-700/60 ' +
  'transition-[border-color,box-shadow] duration-200 focus:border-gold-600 focus:ring-2 focus:ring-gold/30 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-ivory-200'

export function fieldClass(error?: string, className?: string) {
  return cn(inputBase, error ? 'border-red-700' : 'border-charcoal/20', className)
}

/** Label + control + hint + error, wired up for screen readers. */
export function Field({
  id: explicitId,
  label,
  hint,
  error,
  optional,
  children,
  tone = 'dark',
  className,
}: {
  /** Stable id for the control (e.g. to move focus to the first error). */
  id?: string
  label: string
  hint?: ReactNode
  error?: string
  optional?: boolean
  tone?: Tone
  className?: string
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}) {
  const generatedId = useId()
  const id = explicitId ?? generatedId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={id} className={cn('mb-1.5 block text-sm font-medium', tone === 'dark' ? 'text-charcoal' : 'text-ivory')}>
        {label}
        {optional && <span className="ml-1.5 font-normal text-taupe-700">(optional)</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-taupe-700">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextInput({ error, className, ...props }: ComponentProps<'input'> & { error?: string }) {
  return <input className={fieldClass(error, className)} aria-invalid={error ? true : undefined} {...props} />
}

export function TextArea({ error, className, ...props }: ComponentProps<'textarea'> & { error?: string }) {
  return <textarea className={fieldClass(error, cn('min-h-28 resize-y', className))} aria-invalid={error ? true : undefined} {...props} />
}

export function Select({ error, className, children, ...props }: ComponentProps<'select'> & { error?: string }) {
  return (
    <select className={fieldClass(error, cn('appearance-none bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-10', className))} aria-invalid={error ? true : undefined} {...props}>
      {children}
    </select>
  )
}

/** Visually hidden field that only bots fill in. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Leave this field empty
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}
