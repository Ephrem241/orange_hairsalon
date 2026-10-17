/** Cache tags for public content; dashboard mutations expire them with updateTag(). */
export const TAGS = {
  settings: 'settings',
  catalog: 'catalog',
  team: 'team',
  gallery: 'gallery',
  reviews: 'reviews',
} as const

export type CacheTag = (typeof TAGS)[keyof typeof TAGS]
