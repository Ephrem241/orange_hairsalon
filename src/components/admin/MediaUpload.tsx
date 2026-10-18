'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { createUploadUrl, finalizeUpload } from './media-actions'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const VIDEO_TYPES = ['video/mp4', 'video/webm']
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024

/** Downscale to at most `maxSide` px and re-encode as WebP in the browser. */
async function toWebp(file: File, maxSide = 2000): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image'))), 'image/webp', 0.85))
}

/** `path` is what gets saved; `url` is for display. */
export type UploadedMedia = { path: string; url: string; width?: number; height?: number }

/**
 * Upload to Convex file storage (admins only). Type and size are checked here
 * and again by Convex when the upload is finalized.
 */
export function MediaUpload({
  value,
  previewUrl,
  onChange,
  accept = 'image',
  label = 'Image',
}: {
  /** The stored reference, and its displayable URL for the preview. */
  value: string | null
  previewUrl: string | null
  onChange: (media: UploadedMedia | null) => void
  accept?: 'image' | 'video'
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setError(null)
    const allowed = accept === 'video' ? VIDEO_TYPES : IMAGE_TYPES
    if (!allowed.includes(file.type)) {
      setError(accept === 'video' ? 'Use an MP4 or WebM video.' : 'Use a JPEG, PNG, WebP or AVIF image.')
      return
    }
    if (file.size > (accept === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
      setError(accept === 'video' ? 'Videos must be 50 MB or smaller.' : 'Images must be 8 MB or smaller.')
      return
    }
    setBusy(true)
    try {
      let body: Blob = file
      let dims: { width?: number; height?: number } = {}
      if (accept === 'image') {
        body = await toWebp(file)
        const bitmap = await createImageBitmap(body)
        dims = { width: bitmap.width, height: bitmap.height }
      }
      const target = await createUploadUrl()
      if (!target.ok) throw new Error(target.error)
      const response = await fetch(target.data!.url, {
        method: 'POST',
        headers: { 'Content-Type': accept === 'image' ? 'image/webp' : file.type },
        body,
      })
      if (!response.ok) throw new Error('Upload failed.')
      const { storageId } = (await response.json()) as { storageId: string }
      const stored = await finalizeUpload(storageId, accept)
      if (!stored.ok) throw new Error(stored.error)
      onChange({ ...stored.data!, ...dims })
    } catch (e) {
      setError((e as Error).message || 'Upload failed.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex items-center gap-4">
        <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-charcoal/15 bg-ivory-200">
          {value && previewUrl && accept === 'image' ? (
            <Image src={previewUrl} alt="" fill sizes="96px" className="object-cover" />
          ) : value ? (
            <span className="px-2 text-center text-[0.6875rem] text-taupe-700">Video uploaded</span>
          ) : (
            <ImagePlus aria-hidden className="size-6 text-taupe-700" />
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 aria-label="Uploading" className="size-5 animate-spin" />
            </span>
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="rounded-sm border border-charcoal/20 bg-white px-3 py-1.5 text-sm hover:border-charcoal/50">
            {value ? 'Replace' : 'Upload'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 text-xs text-taupe-700 hover:text-red-700">
              <Trash2 aria-hidden className="size-3" /> Remove
            </button>
          )}
          <input
            ref={input}
            type="file"
            hidden
            accept={(accept === 'video' ? VIDEO_TYPES : IMAGE_TYPES).join(',')}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
