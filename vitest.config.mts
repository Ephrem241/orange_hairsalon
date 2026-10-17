import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/db/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    // Each database test file boots its own in-memory Postgres; give it room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
