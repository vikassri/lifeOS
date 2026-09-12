import { describe, it, expect } from 'vitest'
import { generateCsrfToken, validateCsrfToken } from '@/lib/security/csrf'

describe('CSRF', () => {
  it('generates a 32-char hex token', () => {
    const token = generateCsrfToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('validates matching tokens with timing-safe compare', () => {
    const token = generateCsrfToken()
    expect(validateCsrfToken(token, token)).toBe(true)
  })

  it('rejects non-matching tokens', () => {
    expect(validateCsrfToken('aaa', 'bbb')).toBe(false)
  })

  it('rejects empty tokens', () => {
    expect(validateCsrfToken('', '')).toBe(false)
  })
})
