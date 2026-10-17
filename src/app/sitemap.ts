import type { MetadataRoute } from 'next'
import { siteUrl } from '@/config/site'
import { getServices } from '@/lib/data/public'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const services = await getServices()
  const pages = [
    { path: '/', priority: 1 },
    { path: '/services', priority: 0.9 },
    { path: '/book', priority: 0.9 },
    { path: '/gallery', priority: 0.8 },
    { path: '/about', priority: 0.7 },
    { path: '/contact', priority: 0.8 },
    { path: '/terms', priority: 0.3 },
    { path: '/privacy', priority: 0.3 },
  ]
  return [
    ...pages.map((p) => ({ url: `${siteUrl}${p.path}`, changeFrequency: 'weekly' as const, priority: p.priority })),
    // Demo services are never advertised to search engines.
    ...services.filter((s) => !s.isDemo).map((s) => ({ url: `${siteUrl}/services/${s.slug}`, changeFrequency: 'monthly' as const, priority: 0.7 })),
  ]
}
