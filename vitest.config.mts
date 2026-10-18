import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@convex': fileURLToPath(new URL('./convex', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/convex/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    // tests/convex run the real Convex functions in convex-test's in-memory backend
    // (edge-runtime environment, set per file); give them room.
    server: { deps: { inline: ['convex-test'] } },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
