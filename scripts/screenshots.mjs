#!/usr/bin/env node
/**
 * Visual QA helper: full-page screenshots of public routes at desktop and phone
 * widths. Scrolls each page first so scroll-reveal sections are visible.
 *
 *   node scripts/screenshots.mjs [outDir] [/path ...]
 * Requires a running server (BASE_URL, default http://localhost:3000).
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const [outDir = 'screenshots', ...paths] = process.argv.slice(2)
const routes = paths.length ? paths : ['/', '/services', '/gallery', '/about', '/contact', '/book']
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
]

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor ?? 1 })
  const page = await context.newPage()
  for (const route of routes) {
    await page.goto(base + route, { waitUntil: 'networkidle', timeout: 120_000 })
    // Walk down the page so IntersectionObserver reveals fire, then return to the top.
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < height; y += vp.height / 2) {
      await page.evaluate((top) => window.scrollTo(0, top), y)
      await page.waitForTimeout(120)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1500)
    const file = join(outDir, `${vp.name}${route === '/' ? '-home' : route.replace(/\//g, '-')}.jpg`)
    await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 70 })
    console.log(file)
  }
  await context.close()
}
await browser.close()
