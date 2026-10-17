import { supabaseUrl } from '@/lib/env'

export const MEDIA_BUCKET = 'media'

/**
 * Resolve a stored media path. Site-relative paths ("/images/…") are assets
 * shipped with the app; anything else is an object in the public Storage bucket.
 */
export function mediaUrl(path: string): string {
  if (path.startsWith('/') || path.startsWith('https://')) return path
  return `${supabaseUrl}/storage/v1/object/public/${MEDIA_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
}
