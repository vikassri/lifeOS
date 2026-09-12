import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test('login page renders sign-in button and branding', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible()
    await expect(page.getByText('Life OS')).toBeVisible()
    await expect(page.getByText('Your private digital vault')).toBeVisible()
  })

  test('shows unauthorized error message', async ({ page }) => {
    await page.goto('/login?error=unauthorized')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByText('Access denied. This vault is private.')).toBeVisible()
  })

  test('shows access denied error message', async ({ page }) => {
    await page.goto('/login?error=access_denied')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByText('Sign-in was cancelled.')).toBeVisible()
  })
})
