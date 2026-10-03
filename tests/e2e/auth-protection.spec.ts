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

  test('login page requires username and password', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('Username')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('login page shows vault branding', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('lifeOS')).toBeVisible()
    await expect(page.getByText('Your private life, thoughtfully organized.')).toBeVisible()
  })

  test('health endpoint returns 200', async ({ request }) => {
    const res = await request.get('/api/v1/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
