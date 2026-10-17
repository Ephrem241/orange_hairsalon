import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end smoke tests. Locally they reuse a running `npm run dev`; in CI
 * they build and start the production server. No database is required: the
 * booking wizard's API is mocked per test, and demo content is enabled.
 */
const port = Number(process.env.PORT ?? 3000)

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // The dev server compiles routes on demand; one worker keeps timings stable.
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { DEMO_CONTENT: 'true', NEXT_PUBLIC_SITE_URL: `http://localhost:${port}` },
  },
})
