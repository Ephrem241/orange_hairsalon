const LABELS: Record<string, string> = {
  braids: 'Braids & protective',
  colour: 'Colour',
  styling: 'Styling',
  cuts: 'Cuts',
  treatments: 'Treatments',
  bridal: 'Bridal & events',
  salon: 'The salon',
}

export function galleryCategoryLabel(slug: string): string {
  return LABELS[slug] ?? slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export const GALLERY_CATEGORIES = Object.keys(LABELS)
