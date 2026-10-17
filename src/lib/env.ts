/**
 * Environment flags. Only NEXT_PUBLIC_* values are safe in client code; the
 * secret key is read exclusively in server-only modules.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''

/** True when the public Supabase connection is configured. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

/**
 * When the database is not configured, show clearly labelled demo services and
 * stylists. Allowed locally and on preview deployments; a Vercel production
 * deployment can never enable it, whatever DEMO_CONTENT says.
 */
export const isDemoContentEnabled = process.env.DEMO_CONTENT === 'true' && process.env.VERCEL_ENV !== 'production'
