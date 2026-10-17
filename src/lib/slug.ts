export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Stored media: an object in the `media` bucket under a known folder, or an asset shipped in /public. */
export const MEDIA_PATH_PATTERN = /^(?:(?:services|stylists|gallery)\/[a-z0-9][a-z0-9-]*\.(?:webp|jpe?g|png|avif|mp4|webm)|\/(?:images|videos)\/[a-z0-9/._-]+)$/
