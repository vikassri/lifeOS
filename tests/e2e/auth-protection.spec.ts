import { test, expect } from '@playwright/test'

test.describe('Authentication protection', () => {
  test('unauthenticated user is redirected to /login from /dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user is redirected to /login from /vault/passwords', async ({ page }) => {
    await page.goto('/vault/passwords')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page shows Google sign-in button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible()
  })

  test('login page shows vault branding', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Life OS')).toBeVisible()
    await expect(page.getByText('Your private digital vault')).toBeVisible()
  })

  test('health endpoint returns 200', async ({ request }) => {
    const res = await request.get('/api/v1/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
