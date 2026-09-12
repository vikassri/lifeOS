import { randomUUID } from 'crypto'
import { getFirestoreDb } from '@/lib/db/client'
import type { AgentConfig, AgentConfigInput } from './types'

const AGENTS_COLLECTION = (userId: string) => `users/${userId}/agents`

export async function createAgent(
  userId: string,
  input: AgentConfigInput,
): Promise<AgentConfig> {
  const db = getFirestoreDb()
  const id = randomUUID()
  const now = Date.now()

  const agent: AgentConfig = {
    id,
    userId,
    ...input,
    createdAt: now,
    updatedAt: now,
  }

  await db.collection(AGENTS_COLLECTION(userId)).doc(id).set(agent)
  return agent
}

export async function listAgents(userId: string): Promise<AgentConfig[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(AGENTS_COLLECTION(userId))
    .orderBy('createdAt', 'asc')
    .get()

  return snapshot.docs.map(doc => doc.data() as AgentConfig)
}

export async function getAgent(
  userId: string,
  agentId: string,
): Promise<AgentConfig | null> {
  const db = getFirestoreDb()
  const doc = await db
    .collection(AGENTS_COLLECTION(userId))
    .doc(agentId)
    .get()

  if (!doc.exists) return null
  return doc.data() as AgentConfig
}

export async function updateAgent(
  userId: string,
  agentId: string,
  patch: Partial<AgentConfigInput>,
): Promise<AgentConfig> {
  const db = getFirestoreDb()
  const ref = db.collection(AGENTS_COLLECTION(userId)).doc(agentId)
  const existing = await ref.get()
  if (!existing.exists) throw new Error('Agent not found')

  const updates = { ...patch, updatedAt: Date.now() }
  await ref.update(updates)

  return { ...(existing.data() as AgentConfig), ...updates }
}

export async function deleteAgent(userId: string, agentId: string): Promise<void> {
  const db = getFirestoreDb()
  await db.collection(AGENTS_COLLECTION(userId)).doc(agentId).delete()
}

export async function seedDefaultAgents(userId: string): Promise<void> {
  const existing = await listAgents(userId)
  if (existing.length > 0) return // Already seeded

  const defaults: AgentConfigInput[] = [
    {
      name: 'Personal Assistant',
      description: 'General tasks, planning, and everyday help',
      systemPrompt: `You are a personal assistant for a private Life OS. You help with planning, reminders, general questions, and daily tasks. Be concise, practical, and thoughtful. Never share or reference personal data unless the user brings it up. Today's date: ${new Date().toDateString()}.`,
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      maxTokens: 2048,
      contextWindowSize: 20,
      tools: ['date_time', 'calculator'],
      isDefault: true,
    },
    {
      name: 'Research Helper',
      description: 'Deep research, summarization, and analysis',
      systemPrompt: 'You are a research assistant. You provide thorough, accurate, well-cited responses. When asked to summarize, extract key insights. When asked to research, be comprehensive. Always indicate if information might be outdated.',
      model: 'gemini-1.5-pro',
      temperature: 0.3,
      maxTokens: 4096,
      contextWindowSize: 15,
      tools: [],
      isDefault: false,
    },
    {
      name: 'Finance Advisor',
      description: 'Investment analysis, portfolio insights, financial planning',
      systemPrompt: 'You are a financial analysis assistant. You help analyze investments, explain financial concepts, and assist with portfolio thinking. You do NOT provide regulated financial advice. Always remind the user to consult a licensed financial advisor for decisions. Focus on education and analysis.',
      model: 'gemini-1.5-pro',
      temperature: 0.2,
      maxTokens: 2048,
      contextWindowSize: 10,
      tools: ['calculator'],
      isDefault: false,
    },
    {
      name: 'Journal Companion',
      description: 'Reflective prompts, mood tracking, and journaling support',
      systemPrompt: 'You are a compassionate journaling companion. You ask thoughtful, open-ended questions to encourage self-reflection. You help the user explore their thoughts, feelings, and goals. Be warm, non-judgmental, and supportive. Never give unsolicited advice.',
      model: 'gemini-2.0-flash',
      temperature: 0.9,
      maxTokens: 1024,
      contextWindowSize: 20,
      tools: [],
      isDefault: false,
    },
    {
      name: 'Code Assistant',
      description: 'Code review, debugging, architecture, and technical help',
      systemPrompt: 'You are a senior software engineer assistant. You help with code review, debugging, architecture decisions, and technical explanations. You favor security, simplicity, and correctness. Always explain your reasoning. Prefer TypeScript/Python. Point out security issues proactively.',
      model: 'gemini-2.0-flash',
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
