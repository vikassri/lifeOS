import { describe, it, expect } from 'vitest'
import { isAuthorizedEmail } from '@/lib/auth/allowlist'
import { isAuthorizedUsername } from '@/lib/auth/local-auth'

describe('isAuthorizedEmail', () => {
  it('allows the private local identity used for sessions', () => {
    expect(isAuthorizedEmail('onlyricks@lifeos.local')).toBe(true)
  })

  describe('isAuthorizedUsername', () => {
    it('allows only the configured username', () => {
      expect(isAuthorizedUsername('onlyricks')).toBe(true)
      expect(isAuthorizedUsername('OnlyRicks')).toBe(false)
      expect(isAuthorizedUsername('someone@example.com')).toBe(false)
      expect(isAuthorizedUsername('')).toBe(false)
    })
  })

  it('rejects unknown emails', () => {
    expect(isAuthorizedEmail('attacker@evil.com')).toBe(false)
    expect(isAuthorizedEmail('')).toBe(false)
    expect(isAuthorizedEmail('ONLYRICKS@LIFEOS.LOCAL')).toBe(false) // case-sensitive
  })

  it('rejects email with trailing whitespace (no normalization)', () => {
    expect(isAuthorizedEmail('onlyricks@lifeos.local ')).toBe(false)
  })
})
