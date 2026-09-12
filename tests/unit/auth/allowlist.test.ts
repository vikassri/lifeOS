import { describe, it, expect } from 'vitest'
import { isAuthorizedEmail } from '@/lib/auth/allowlist'

describe('isAuthorizedEmail', () => {
  it('allows the authorized email', () => {
    expect(isAuthorizedEmail('er.vikassri@gmail.com')).toBe(true)
  })

  it('rejects unknown emails', () => {
    expect(isAuthorizedEmail('attacker@evil.com')).toBe(false)
    expect(isAuthorizedEmail('')).toBe(false)
    expect(isAuthorizedEmail('ER.VIKASSRI@GMAIL.COM')).toBe(false) // case-sensitive
  })

  it('rejects email with trailing whitespace (no normalization)', () => {
    expect(isAuthorizedEmail('er.vikassri@gmail.com ')).toBe(false)
  })
})
