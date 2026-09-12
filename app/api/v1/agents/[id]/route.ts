import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/middleware/api-guard'
import { getAgent, updateAgent, deleteAgent } from '@/lib/ai/agents'
import { createErrorResponse, safeError } from '@/lib/errors/api-error'
import type { SessionData } from '@/lib/auth/session'

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(1).max(8000).optional(),
  model: z.enum(['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gpt-4o', 'gpt-4o-mini']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(8192).optional(),
  contextWindowSize: z.number().int().min(1).max(50).optional(),
  tools: z.array(z.enum(['web_search', 'calculator', 'date_time', 'vault_search'])).optional(),
  isDefault: z.boolean().optional(),
})

export const GET = withApiGuard(
  async (req: NextRequest, { session }: { session: SessionData }) => {
    const id = req.nextUrl.pathname.split('/').pop() ?? ''
    const agent = await getAgent(session.sub, id)
    if (!agent) return createErrorResponse(404, 'Agent not found')
    const { userId: _userId, ...publicAgent } = agent
    return Response.json({ agent: publicAgent })
  },
  { skipCsrf: true },
)

export const PUT = withApiGuard(
  async (req: NextRequest, { session }: { session: SessionData }) => {
    const id = req.nextUrl.pathname.split('/').pop() ?? ''
    const body = await req.json().catch(() => null)
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) return createErrorResponse(400, 'Invalid update data')
    try {
      const updated = await updateAgent(session.sub, id, parsed.data)
      const { userId: _userId, ...publicAgent } = updated
      return Response.json({ agent: publicAgent })
    } catch (err) {
      return createErrorResponse(500, safeError(err).message)
    }
  },
)

export const DELETE = withApiGuard(
  async (req: NextRequest, { session }: { session: SessionData }) => {
    const id = req.nextUrl.pathname.split('/').pop() ?? ''
    try {
      await deleteAgent(session.sub, id)
      return Response.json({ success: true })
    } catch (err) {
      return createErrorResponse(500, safeError(err).message)
    }
  },
)
