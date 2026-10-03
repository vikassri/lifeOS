import 'server-only'
import { randomUUID } from 'crypto'
import { getDb } from '@/lib/db/client'
import type { AgentConfig, AgentConfigInput } from './types'

export async function listAgents(userId: string): Promise<AgentConfig[]> {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM agents WHERE user_id = ? ORDER BY created_at ASC').all(userId) as any[]
  return rows.map(rowToAgent)
}

export async function getAgent(userId: string, agentId: string): Promise<AgentConfig | null> {
  const db = getDb()
  const row = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(agentId, userId) as any
  return row ? rowToAgent(row) : null
}

export async function createAgent(
  userId: string,
  input: AgentConfigInput,
): Promise<AgentConfig> {
  const db = getDb()
  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)
  db.prepare(`
    INSERT INTO agents (id, user_id, name, description, system_prompt, model, temperature, max_tokens, context_window_size, tools, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    input.name,
    input.description ?? '',
    input.systemPrompt,
    input.model ?? 'gpt-4o-mini',
    input.temperature ?? 0.7,
    input.maxTokens ?? 2048,
    input.contextWindowSize ?? 20,
    JSON.stringify(input.tools ?? []),
    input.isDefault ? 1 : 0,
    now,
    now,
  )
  return (await getAgent(userId, id)) as AgentConfig
}

export async function updateAgent(
  userId: string,
  agentId: string,
  patch: Partial<AgentConfigInput>,
): Promise<AgentConfig> {
  const db = getDb()
  const existing = await getAgent(userId, agentId)
  if (!existing) throw new Error('Agent not found')
  const now = Math.floor(Date.now() / 1000)
  db.prepare(`
    UPDATE agents
    SET name = ?, description = ?, system_prompt = ?, model = ?, temperature = ?, max_tokens = ?,
        context_window_size = ?, tools = ?, is_default = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    patch.name ?? existing.name,
    patch.description ?? existing.description,
    patch.systemPrompt ?? existing.systemPrompt,
    patch.model ?? existing.model,
    patch.temperature ?? existing.temperature,
    patch.maxTokens ?? existing.maxTokens,
    patch.contextWindowSize ?? existing.contextWindowSize,
    JSON.stringify(patch.tools ?? existing.tools),
    patch.isDefault !== undefined ? (patch.isDefault ? 1 : 0) : (existing.isDefault ? 1 : 0),
    now,
    agentId,
    userId,
  )
  return (await getAgent(userId, agentId)) as AgentConfig
}

export async function deleteAgent(userId: string, agentId: string): Promise<void> {
  const db = getDb()
  db.prepare('DELETE FROM agents WHERE id = ? AND user_id = ?').run(agentId, userId)
}

export async function seedDefaultAgents(userId: string): Promise<void> {
  const db = getDb()
  const count = (db.prepare('SELECT COUNT(*) as c FROM agents WHERE user_id = ?').get(userId) as any).c
  if (count > 0) return

  const defaults: AgentConfigInput[] = [
    {
      name: 'Personal Assistant',
      description: 'General tasks, planning, and everyday help',
      systemPrompt: `You are a personal assistant for a private Life OS. You help with planning, reminders, general questions, and daily tasks. Be concise, practical, and thoughtful. Today's date: ${new Date().toDateString()}.`,
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 2048,
      contextWindowSize: 20,
      tools: ['date_time', 'calculator'],
      isDefault: true,
    },
    {
      name: 'Research Helper',
      description: 'Deep research, summarization, and analysis',
      systemPrompt: 'You are a research assistant. You provide thorough, accurate, well-cited responses. When asked to summarize, extract key insights. When asked to research, be comprehensive.',
      model: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 4096,
      contextWindowSize: 15,
      tools: [],
      isDefault: false,
    },
    {
      name: 'Finance Advisor',
      description: 'Investment analysis, portfolio insights, financial planning',
      systemPrompt: 'You are a financial analysis assistant. You help analyze investments, explain financial concepts, and assist with portfolio thinking. Always remind the user to consult a licensed financial advisor for major decisions.',
      model: 'gpt-4o-mini',
      temperature: 0.2,
      maxTokens: 2048,
      contextWindowSize: 10,
      tools: ['calculator'],
      isDefault: false,
    },
    {
      name: 'Journal Companion',
      description: 'Reflective prompts, mood tracking, and journaling support',
      systemPrompt: 'You are a compassionate journaling companion. You ask thoughtful, open-ended questions to encourage self-reflection. Be warm, non-judgmental, and supportive.',
      model: 'gpt-4o-mini',
      temperature: 0.9,
      maxTokens: 1024,
      contextWindowSize: 20,
      tools: [],
      isDefault: false,
    },
    {
      name: 'Code Assistant',
      description: 'Code review, debugging, architecture, and technical help',
      systemPrompt: 'You are a senior software engineer assistant. You help with code review, debugging, architecture decisions, and technical explanations. Prefer TypeScript/Python. Point out security issues proactively.',
      model: 'gpt-4o-mini',
      temperature: 0.2,
      maxTokens: 4096,
      contextWindowSize: 15,
      tools: [],
      isDefault: false,
    },
  ]

  for (const config of defaults) {
    await createAgent(userId, config)
  }
}

function rowToAgent(row: any): AgentConfig {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    systemPrompt: row.system_prompt,
    model: row.model,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    contextWindowSize: row.context_window_size,
    tools: JSON.parse(row.tools ?? '[]'),
    isDefault: row.is_default === 1,
    createdAt: row.created_at * 1000,
    updatedAt: row.updated_at * 1000,
  }
}
