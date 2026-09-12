import { describe, it, expect } from 'vitest'
import { sanitizeInput } from '@/lib/security/sanitize'

describe('sanitizeInput', () => {
  it('strips null bytes', () => {
    expect(sanitizeInput('hello\0world')).toBe('helloworld')
  })

  it('strips control characters', () => {
    expect(sanitizeInput('hello\x01\x02world')).toBe('helloworld')
  })

  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })

  it('preserves normal text', () => {
    expect(sanitizeInput('Hello, World!')).toBe('Hello, World!')
  })
})
