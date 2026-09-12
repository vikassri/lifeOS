import { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { z } from 'zod'
import { getSessionOptions, isSessionValid, type SessionData } from '@/lib/auth/session'
import { streamChat } from '@/lib/ai/chat'
import { createErrorResponse } from '@/lib/errors/api-error'
import { apiRateLimiter } from '@/lib/security/rate-limit'

const ChatRequestSchema = z.object({
  agentId: z.string().uuid(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(10_000),
    }),
  ).min(1).max(50),
})

export async function POST(req: NextRequest): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (!apiRateLimiter(ip)) return createErrorResponse(429, 'Too many requests')

  const session = await getIronSession<SessionData>(req, new Response(), getSessionOptions())
  if (!isSessionValid(session)) return createErrorResponse(401, 'Authentication required')

  const body = await req.json().catch(() => null)
  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) return createErrorResponse(400, 'Invalid request')

  const { agentId, messages } = parsed.data

  // Return Server-Sent Events stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat(session.sub, agentId, messages)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
