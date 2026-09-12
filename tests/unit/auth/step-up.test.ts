import { describe, it, expect, vi } from 'vitest'
import { requiresStepUp, grantStepUp } from '@/lib/auth/step-up'
import type { SessionData } from '@/lib/auth/session'

const baseSession: SessionData = {
  sub: 'user-123',
  email: 'er.vikassri@gmail.com',
  iat: Date.now(),
  exp: Date.now() + 8 * 60 * 60 * 1000,
  stepUpExpiry: null,
}

describe('requiresStepUp', () => {
  it('requires step-up when stepUpExpiry is null', () => {
    expect(requiresStepUp({ ...baseSession, stepUpExpiry: null })).toBe(true)
  })

  it('requires step-up when stepUpExpiry is in the past', () => {
    expect(requiresStepUp({ ...baseSession, stepUpExpiry: Date.now() - 1 })).toBe(true)
  })

  it('does NOT require step-up when stepUpExpiry is in the future', () => {
    expect(requiresStepUp({ ...baseSession, stepUpExpiry: Date.now() + 10_000 })).toBe(false)
  })
})

describe('grantStepUp', () => {
  it('sets stepUpExpiry 15 minutes in the future', () => {
    const before = Date.now()
    const updated = grantStepUp(baseSession)
    const after = Date.now()
    expect(updated.stepUpExpiry).toBeGreaterThanOrEqual(before + 15 * 60 * 1000 - 10)
    expect(updated.stepUpExpiry).toBeLessThanOrEqual(after + 15 * 60 * 1000 + 10)
  })
})
