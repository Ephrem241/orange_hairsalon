'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'

/**
 * Click-to-load map: no third-party requests (or tracking) until the visitor
 * asks for the map, and no layout shift since the frame reserves its space.
 */
export function LocationMap({ query, label, className = 'aspect-[4/3]' }: { query: string; label: string; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
  return (
    <div className={`relative w-full overflow-hidden rounded-sm bg-charcoal-700 ${className}`}>
      {loaded ? (
        <iframe
          title={`Map showing ${label}`}
          src={src}
          className="absolute inset-0 size-full border-0 grayscale-[35%]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="group absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_center,_rgba(201,133,69,0.18),_transparent_65%)] text-ivory/80"
        >
          <span className="flex size-14 items-center justify-center rounded-full border border-gold/60 text-gold transition-transform duration-500 group-hover:scale-110">
            <MapPin aria-hidden className="size-6" />
          </span>
          <span className="text-sm">Show map</span>
          <span className="text-xs text-ivory/50">Loads Google Maps</span>
        </button>
      )}
    </div>
  )
}
