import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  getFirestoreDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn(async () => {}),
        get: vi.fn(async () => ({ exists: true, data: () => mockAgent, id: 'agent-1' })),
        update: vi.fn(async () => {}),
        delete: vi.fn(async () => {}),
      })),
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          get: vi.fn(async () => ({ docs: [{ id: 'agent-1', data: () => mockAgent }] })),
        })),
      })),
      orderBy: vi.fn(() => ({
        get: vi.fn(async () => ({ docs: [{ id: 'agent-1', data: () => mockAgent }] })),
      })),
    })),
  })),
}))

const mockAgent = {
  id: 'agent-1',
  userId: 'user-123',
  name: 'Test Agent',
  description: 'A test agent',
  systemPrompt: 'You are a helpful assistant.',
  model: 'gemini-2.0-flash',
  temperature: 0.7,
  maxTokens: 2048,
  contextWindowSize: 10,
  tools: [],
  isDefault: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

import { createAgent, listAgents, deleteAgent } from '@/lib/ai/agents'

describe('Agent CRUD', () => {
  it('createAgent returns AgentConfig with id', async () => {
    const agent = await createAgent('user-123', {
      name: 'Test Agent',
      description: 'A test agent',
      systemPrompt: 'You are a helpful assistant.',
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      maxTokens: 2048,
      contextWindowSize: 10,
      tools: [],
      isDefault: false,
    })
    expect(agent).toHaveProperty('id')
    expect(agent.name).toBe('Test Agent')
    expect(agent.userId).toBe('user-123')
  })

  it('listAgents returns array', async () => {
    const agents = await listAgents('user-123')
    expect(Array.isArray(agents)).toBe(true)
  })

  it('deleteAgent resolves without error', async () => {
    await expect(deleteAgent('user-123', 'agent-1')).resolves.toBeUndefined()
  })
})
