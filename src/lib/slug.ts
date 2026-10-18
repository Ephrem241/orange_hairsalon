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

/** Stored media: a Convex storage id (an upload), or an asset shipped in /public. */
export const MEDIA_PATH_PATTERN = /^(?:[a-z0-9]{20,64}|\/(?:images|videos)\/[a-z0-9/._-]+)$/
