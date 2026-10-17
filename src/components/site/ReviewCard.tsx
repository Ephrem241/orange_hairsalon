import { ExternalLink, Star } from 'lucide-react'
import type { Review } from '@/lib/types'

const SOURCE_LABEL: Record<Review['source'], string> = {
  google: 'Google review',
  tripadvisor: 'Tripadvisor review',
  facebook: 'Facebook review',
  instagram: 'Instagram',
  in_person: 'Shared with the salon',
  other: 'Verified review',
}

/** Verified reviews only — each shows where it came from. */
export function ReviewCard({ review }: { review: Review }) {
  return (
    <figure className="flex h-full flex-col rounded-sm border border-charcoal/10 bg-white p-7">
      {review.rating && (
        <div className="flex gap-0.5 text-gold" role="img" aria-label={`Rated ${review.rating} out of 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} aria-hidden className={i < review.rating! ? 'size-4 fill-current' : 'size-4 opacity-30'} />
          ))}
        </div>
      )}
      <blockquote className="mt-4 flex-1 font-serif text-lg leading-relaxed text-charcoal">“{review.body}”</blockquote>
      <figcaption className="mt-6 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-charcoal">{review.authorName}</span>
        {review.sourceUrl ? (
          <a
            href={review.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-taupe-700 hover:text-gold-700"
          >
            {SOURCE_LABEL[review.source]} <ExternalLink aria-hidden className="size-3" />
          </a>
        ) : (
          <span className="text-xs text-taupe-700">{SOURCE_LABEL[review.source]}</span>
        )}
      </figcaption>
    </figure>
  )
}
