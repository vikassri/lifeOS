import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/middleware/api-guard'
import { createAgent, listAgents } from '@/lib/ai/agents'
import { createErrorResponse, safeError } from '@/lib/errors/api-error'
import type { SessionData } from '@/lib/auth/session'

const AgentInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  systemPrompt: z.string().min(1).max(8000),
  model: z.enum(['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gpt-4o', 'gpt-4o-mini']),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(256).max(8192),
  contextWindowSize: z.number().int().min(1).max(50),
  tools: z.array(z.enum(['web_search', 'calculator', 'date_time', 'vault_search'])),
  isDefault: z.boolean(),
})

export const GET = withApiGuard(
  async (_req: NextRequest, { session }: { session: SessionData }) => {
    const agents = await listAgents(session.sub)
    const publicAgents = agents.map(({ userId: _userId, ...rest }) => rest)
    return Response.json({ agents: publicAgents })
  },
  { skipCsrf: true },
)

export const POST = withApiGuard(
  async (req: NextRequest, { session }: { session: SessionData }) => {
    const body = await req.json().catch(() => null)
    const parsed = AgentInputSchema.safeParse(body)
    if (!parsed.success) return createErrorResponse(400, 'Invalid agent configuration')

    try {
      const agent = await createAgent(session.sub, parsed.data)
      const { userId: _userId, ...publicAgent } = agent
      return Response.json({ agent: publicAgent }, { status: 201 })
    } catch (err) {
      return createErrorResponse(500, safeError(err).message)
    }
  },
)
