import { defineApp } from 'convex/server'
import { v } from 'convex/values'

const app = defineApp({
  env: {
    // Shared with the Next.js server, which proves its calls with it (lib/access.ts).
    // Optional so a fresh deployment can be pushed before it is set; calls fail closed.
    CONVEX_SERVER_SECRET: v.optional(v.string()),
    // "true" only on development deployments that may receive demo data (seed.ts).
    ALLOW_DEMO_SEED: v.optional(v.string()),
  },
})

export default app
