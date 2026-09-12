import { describe, it, expect } from 'vitest'
import { buildMessages, trimToContextWindow } from '@/lib/ai/provider'
import type { ChatMessage } from '@/lib/ai/types'

describe('buildMessages', () => {
  it('prepends system prompt to message array', () => {
    const msgs: ChatMessage[] = [{ role: 'user', content: 'Hello' }]
    const result = buildMessages('You are helpful.', msgs)
    expect(result[0]).toEqual({ role: 'system', content: 'You are helpful.' })
    expect(result[1]).toEqual({ role: 'user', content: 'Hello' })
  })

  it('returns system message + all user messages', () => {
    const msgs: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]
    const result = buildMessages('You are helpful.', msgs)
    expect(result).toHaveLength(3)
    expect(result[0]?.role).toBe('system')
  })
})

describe('trimToContextWindow', () => {
  it('keeps only the last N messages', () => {
    const msgs: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }))
    const trimmed = trimToContextWindow(msgs, 5)
    expect(trimmed).toHaveLength(5)
    expect(trimmed[0]?.content).toBe('Message 15')
  })

  it('returns all messages when under window', () => {
    const msgs: ChatMessage[] = [{ role: 'user', content: 'Hi' }]
    expect(trimToContextWindow(msgs, 10)).toHaveLength(1)
  })

  it('returns all messages when exactly at window size', () => {
    const msgs: ChatMessage[] = Array.from({ length: 5 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
    }))
    expect(trimToContextWindow(msgs, 5)).toHaveLength(5)
  })
})
