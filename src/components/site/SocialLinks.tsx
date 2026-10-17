import type { Socials } from '@/lib/types'
import { cn } from '@/lib/cn'

// Simple monochrome brand glyphs (lucide no longer ships brand icons).
const paths: Record<keyof Socials, string> = {
  instagram:
    'M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 4.8a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zm5.2-9.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z',
  facebook:
    'M13.5 21.8v-8.1h2.7l.4-3.2h-3.1V8.5c0-.9.3-1.5 1.6-1.5h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5v3.2h2.7v8.1h3.3z',
  tiktok:
    'M16.6 5.8a4.3 4.3 0 0 1-1-2.8h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.8 5.8 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.3-1.6z',
  youtube:
    'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z',
  telegram:
    'M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.2 1.8 11.7c-1-.3-1-1 .2-1.5L20.5 3.1c.8-.3 1.6.2 1.4 1.2z',
}

const labels: Record<keyof Socials, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  telegram: 'Telegram',
}

/** Renders only the networks the salon has configured in settings. */
export function SocialLinks({ socials, className }: { socials: Socials; className?: string }) {
  const entries = (Object.keys(paths) as (keyof Socials)[]).filter((k) => socials[k])
  if (entries.length === 0) return null
  return (
    <ul className={cn('flex items-center gap-4', className)}>
      {entries.map((key) => (
        <li key={key}>
          <a
            href={socials[key]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Orange Salon on ${labels[key]}`}
            className="text-ivory/70 transition-colors hover:text-gold"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-[1.125rem] fill-current">
              <path d={paths[key]} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  )
}
