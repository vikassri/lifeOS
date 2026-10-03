import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the SQLite client before importing agents
vi.mock('@/lib/db/client', () => {
  const agents = new Map<string, any>()

  const mockDb = {
    prepare: vi.fn((sql: string) => {
      return {
        all: vi.fn((...params: any[]) => {
          const userId = params[0]
          return Array.from(agents.values()).filter(a => a.user_id === userId)
        }),
        get: vi.fn((...params: any[]) => {
          const [id, userId] = params
          return agents.get(id) ?? null
        }),
        run: vi.fn((...params: any[]) => {
          if (sql.includes('INSERT INTO agents')) {
            const [id, user_id, name, description, system_prompt, model, temperature, max_tokens, context_window_size, tools, is_default, created_at, updated_at] = params
            agents.set(id, { id, user_id, name, description, system_prompt, model, temperature, max_tokens, context_window_size, tools, is_default, created_at, updated_at })
          } else if (sql.includes('DELETE FROM agents')) {
            const [id] = params
            agents.delete(id)
          } else if (sql.includes('UPDATE agents')) {
            // last two params are agentId, userId
            const agentId = params[params.length - 2]
            const existing = agents.get(agentId)
            if (existing) {
              const [name, description, system_prompt, model, temperature, max_tokens, context_window_size, tools, is_default, updated_at] = params
              agents.set(agentId, { ...existing, name, description, system_prompt, model, temperature, max_tokens, context_window_size, tools, is_default, updated_at })
            }
          }
          return { changes: 1 }
        }),
      }
    }),
  }

  return {
    getDb: vi.fn(() => mockDb),
  }
})

import { createAgent, listAgents, deleteAgent } from '@/lib/ai/agents'

describe('Agent CRUD', () => {
  it('createAgent returns AgentConfig with id', async () => {
    const agent = await createAgent('user-123', {
      name: 'Test Agent',
      description: 'A test agent',
      systemPrompt: 'You are a helpful assistant.',
      model: 'gpt-4o-mini',
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
