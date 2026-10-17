import { cn } from '@/lib/cn'

/** Marks development-only sample content so it is never mistaken for the real menu. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      title="Sample content for development — not part of the salon's real menu"
      className={cn(
        'inline-flex items-center rounded-sm border border-dashed border-gold-700/60 bg-ivory/90 px-1.5 py-0.5',
        'font-sans text-[0.625rem] font-semibold tracking-[0.18em] text-gold-700 uppercase',
        className,
      )}
    >
      Demo
    </span>
  )
}
