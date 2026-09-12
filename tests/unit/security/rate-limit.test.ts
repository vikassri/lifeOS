import { describe, it, expect } from 'vitest'
import { createRateLimiter } from '@/lib/security/rate-limit'

describe('RateLimiter', () => {
  it('allows requests under the limit', () => {
    const limiter = createRateLimiter(5, 60_000)
    for (let i = 0; i < 5; i++) {
      expect(limiter('user-1')).toBe(true)
    }
  })

  it('blocks requests over the limit', () => {
    const limiter = createRateLimiter(2, 60_000)
    limiter('user-2')
    limiter('user-2')
    expect(limiter('user-2')).toBe(false)
  })

  it('tracks different keys independently', () => {
    const limiter = createRateLimiter(1, 60_000)
    expect(limiter('a')).toBe(true)
    expect(limiter('b')).toBe(true)
    expect(limiter('a')).toBe(false)
  })
})
