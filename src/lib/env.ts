/**
 * Environment flags. Only NEXT_PUBLIC_* values are safe in client code; the
 * Convex server secret is read exclusively in server-only modules.
 */
export const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? ''

/** True when a Convex deployment is configured. */
export const isConvexConfigured = Boolean(convexUrl)

/**
 * When the database is not configured, show clearly labelled demo services and
 * stylists. Allowed locally and on preview deployments; a Vercel production
 * deployment can never enable it, whatever DEMO_CONTENT says.
 */
export const isDemoContentEnabled = process.env.DEMO_CONTENT === 'true' && process.env.VERCEL_ENV !== 'production'
