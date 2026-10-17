import { expect, test } from '@playwright/test'

test.describe('homepage', () => {
  test('presents the cinematic hero with verified details', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your Hair. Your Style.')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Confidence.')
    await expect(page.getByRole('link', { name: 'Explore Our Services' })).toHaveAttribute('href', '/services')
    await expect(page.getByRole('link', { name: 'Book Your Appointment' })).toHaveAttribute('href', '/book')
    // Verified phone and hours are shown; the mockup's invented stylists are not.
    const footer = page.locator('footer')
    await expect(footer.getByRole('link', { name: '+251 91 241 9748' })).toBeAttached()
    await expect(footer.getByText('Mon – Sat')).toBeAttached()
    await expect(footer.getByText('Ednamoll Street, Addis Ababa')).toBeAttached()
    await expect(page.getByText('Sara Ahmed')).toHaveCount(0)
    await expect(page.getByText('4.9/5')).toHaveCount(0)
  })

  test('background film is muted, inline, looping and pausable', async ({ page }) => {
    await page.goto('/')
    const video = page.locator('#hero-title').locator('xpath=ancestor::section').locator('video')
    await expect(video).toHaveCount(1)
    expect(await video.evaluate((v: HTMLVideoElement) => ({ muted: v.muted, loop: v.loop, inline: v.playsInline }))).toEqual({
      muted: true, loop: true, inline: true,
    })
    await expect(page.getByRole('button', { name: /pause hero film/i })).toBeVisible()
    // The optimised poster is always present underneath.
    await expect(page.locator('section picture img').first()).toHaveAttribute('src', /hero-poster/)
  })

  test('shows only the poster when the visitor prefers reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForTimeout(1000)
    await expect(page.locator('section video')).toHaveCount(0)
    await expect(page.locator('section picture img').first()).toBeVisible()
    await context.close()
  })

  test('publishes HairSalon structured data from verified settings', async ({ page }) => {
    await page.goto('/')
    const json = await page.locator('script[type="application/ld+json"]').first().textContent()
    const data = JSON.parse(json!)
    expect(data['@type']).toBe('HairSalon')
    expect(data.telephone).toBe('+251912419748')
    expect(data.address.streetAddress).toBe('Ednamoll Street')
    expect(data).not.toHaveProperty('aggregateRating')
  })
})

test.describe('navigation', () => {
  test('mobile menu opens, traps focus and closes with Escape', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only')
    await page.goto('/')
    const toggle = page.getByRole('button', { name: 'Open menu' })
    await toggle.click()
    const menu = page.getByRole('dialog', { name: 'Menu' })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Services' })).toBeVisible()
    for (let i = 0; i < 15; i++) await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.closest('#mobile-menu') !== null)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused()
  })

  test('every main page renders with its own title', async ({ page }) => {
    for (const [path, title] of [
      ['/services', /Services & Prices/],
      ['/gallery', /Gallery/],
      ['/about', /About/],
      ['/contact', /Contact/],
      ['/book', /Book an Appointment/],
    ] as const) {
      const response = await page.goto(path)
      expect(response?.status(), path).toBe(200)
      await expect(page).toHaveTitle(title)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${path}$`))
    }
  })

  test('pages load without console errors or hydration mismatches', async ({ page }) => {
    const problems: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(m.text())
    })
    page.on('pageerror', (e) => problems.push(e.message))
    for (const path of ['/', '/services', '/gallery', '/about', '/contact', '/book', '/booking/manage', '/privacy', '/terms']) {
      await page.goto(path, { waitUntil: 'networkidle' })
    }
    expect(problems).toEqual([])
  })

  test('unknown pages return 404', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: /moved on/i })).toBeVisible()
  })
})

test.describe('gallery', () => {
  test('filters by category and opens the full-screen viewer', async ({ page }) => {
    await page.goto('/gallery')
    await page.getByRole('group', { name: 'Filter by style' }).getByRole('button', { name: 'Colour', exact: true }).click()
    await expect(page).toHaveURL(/category=colour/)
    const first = page.getByRole('button', { name: /^Open / }).first()
    await first.click()
    const viewer = page.getByRole('dialog')
    await expect(viewer).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(viewer).toBeHidden()
  })
})

test.describe('contact form', () => {
  test('validates before sending', async ({ page }) => {
    await page.goto('/contact')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByText('Please enter your full name.')).toBeVisible()
    await page.getByLabel('Your name').fill('Hana Tesfaye')
    await page.getByLabel('Message').fill('Hello')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByText('Please give us a phone number or email so we can reply.')).toBeVisible()
  })
})

test.describe('privacy and access', () => {
  test('the dashboard requires signing in', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible()
    await expect(page.getByRole('link', { name: /sign up|register/i })).toHaveCount(0)
  })

  test('a booking URL alone reveals nothing', async ({ page }) => {
    await page.goto('/booking/confirmation/OS-7K4M2P')
    await expect(page.getByRole('heading', { name: 'View your booking' })).toBeVisible()
    await expect(page.getByLabel('Phone number used to book')).toBeVisible()
    await expect(page.getByLabel('Booking reference')).toHaveValue('OS-7K4M2P')
  })

  test('robots and sitemap keep private areas out of search', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text()
    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain('Disallow: /booking/')
    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).toContain('/services')
    expect(sitemap).not.toContain('demo-')
  })

  test('public API refuses invalid bookings', async ({ request }) => {
    const response = await request.post('/api/booking', { data: { serviceId: 'nope' } })
    expect([422, 503]).toContain(response.status())
  })
})
