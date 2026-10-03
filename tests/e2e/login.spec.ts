import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test('login page asks for username and password with branding', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('Username')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByText('lifeOS')).toBeVisible()
    await expect(page.getByText('Your private life, thoughtfully organized.')).toBeVisible()
  })

  test('shows a generic invalid-credentials error', async ({ page }) => {
    await page.goto('/login?error=invalid_credentials')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByText('Invalid username or password. Try again.')).toBeVisible()
  })

  test('asks for both credentials when either is missing', async ({ page }) => {
    await page.goto('/login?error=missing_credentials')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByText('Enter your username and password.')).toBeVisible()
  })
})
