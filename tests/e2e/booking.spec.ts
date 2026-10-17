import { expect, test, type Page } from '@playwright/test'

/**
 * Drives the booking wizard against a mocked booking API (the database engine
 * itself is covered by tests/db). Runs on the demo menu.
 */
function addisDate(offsetDays: number) {
  const now = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' }).format(now)
}

async function mockAvailability(page: Page) {
  const bookable = [addisDate(3), addisDate(4), addisDate(5)]
  await page.route('**/api/booking/availability**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('from')) {
      await route.fulfill({ json: { days: bookable } })
      return
    }
    const date = url.searchParams.get('date')!
    await route.fulfill({
      json: {
        date,
        slots: ['07:00', '07:30', '11:00', '14:00'].map((t) => ({ startsAt: new Date(`${date}T${t}:00+03:00`).toISOString(), stylistsFree: 1 })),
      },
    })
  })
  return bookable
}

async function reachDetails(page: Page, bookable: string[]) {
  await page.goto('/book')
  await page.getByRole('button', { name: /Knotless Braids/ }).click()
  await expect(page.getByRole('heading', { name: 'Choose a stylist' })).toBeVisible()
  await page.getByRole('button', { name: /Any available stylist/ }).click()
  await expect(page.getByRole('heading', { name: 'Choose a date and time' })).toBeVisible()

  // Navigate months if the first bookable day is next month.
  const target = bookable[0]
  const day = page.locator(`[data-date="${target}"]`)
  if ((await day.count()) === 0) await page.getByRole('button', { name: 'Next month' }).click()
  await expect(day).toBeEnabled()
  await day.click()
  await page.getByRole('button', { name: '11:00 AM', exact: true }).click() // mocked as 11:00 Addis time (+03:00)
  await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible()
}

test('books an appointment through every step and lands on the confirmation page', async ({ page }) => {
  const bookable = await mockAvailability(page)
  let submitted: Record<string, unknown> | null = null
  await page.route('**/api/booking', async (route) => {
    submitted = route.request().postDataJSON()
    await route.fulfill({ status: 201, json: { booking: { reference: 'OS-7K4M2P', status: 'pending' } } })
  })

  await reachDetails(page, bookable)

  // Validation before review.
  await page.getByRole('button', { name: 'Review booking' }).click()
  await expect(page.getByText('Please enter your full name.')).toBeVisible()
  await expect(page.getByText('Please accept the booking policy to continue.')).toBeVisible()

  await page.getByLabel('Full name').fill('Hana Tesfaye')
  await page.getByLabel('Phone number').fill('0911 22 33 44')
  await page.getByLabel(/^Email/).fill('hana@example.com')
  await page.getByLabel('I have read and accept the booking policy.').check()
  await page.getByRole('button', { name: 'Review booking' }).click()

  await expect(page.getByRole('heading', { name: 'Review and request' })).toBeVisible()
  await expect(page.locator('dl').getByText('Any available stylist')).toBeVisible()
  await expect(page.locator('dl').getByText(/11:00 AM/)).toBeVisible()
  await expect(page.getByText(/From ETB 4,500 · paid at the salon/)).toBeVisible()
  await expect(page.getByText(/sends a booking request/)).toBeVisible()

  await page.getByRole('button', { name: 'Request appointment' }).click()
  await expect(page).toHaveURL(/\/booking\/confirmation\/OS-7K4M2P/)
  expect(submitted).toMatchObject({ fullName: 'Hana Tesfaye', phone: '0911 22 33 44', policyAccepted: true, stylistId: null })
})

test('a slot taken by someone else sends the client back to fresh times', async ({ page }) => {
  const bookable = await mockAvailability(page)
  await page.route('**/api/booking', (route) =>
    route.fulfill({ status: 409, json: { error: { code: 'SLOT_TAKEN', message: 'Sorry — that time was just booked by someone else.' } } }),
  )
  await reachDetails(page, bookable)
  await page.getByLabel('Full name').fill('Hana Tesfaye')
  await page.getByLabel('Phone number').fill('0911223344')
  await page.getByLabel('I have read and accept the booking policy.').check()
  await page.getByRole('button', { name: 'Review booking' }).click()
  await page.getByRole('button', { name: 'Request appointment' }).click()

  await expect(page.getByText('That time is no longer available')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Choose a date and time' })).toBeVisible()
  await expect(page).not.toHaveURL(/time=/)
})

test('personal details never appear in the URL', async ({ page }) => {
  const bookable = await mockAvailability(page)
  await reachDetails(page, bookable)
  await page.getByLabel('Full name').fill('Hana Tesfaye')
  await page.getByLabel('Phone number').fill('0911223344')
  expect(page.url()).not.toContain('Hana')
  expect(page.url()).not.toContain('0911223344')
})
