import type { NextConfig } from 'next'

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null
  } catch {
    return null
  }
})()

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    // Pin the root: a stray lockfile in the user's home directory confuses auto-detection.
    root: __dirname,
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 75, 85],
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/media/**' }]
      : [],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Personal booking pages and the dashboard must never be cached by a CDN.
      { source: '/booking/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/admin/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      // Media is content-addressed by the pipeline; let browsers keep it.
      { source: '/videos/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
    ]
  },
}

export default nextConfig
