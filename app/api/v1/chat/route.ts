import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/middleware/api-guard'
import { streamChat } from '@/lib/ai/chat'
import { createErrorResponse } from '@/lib/errors/api-error'
import type { SessionData } from '@/lib/auth/session'

const ChatRequestSchema = z.object({
  agentId: z.string().uuid(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(10_000),
    }),
  ).min(1).max(50),
})

export const POST = withApiGuard(
  async (req: NextRequest, { session }: { session: SessionData }) => {
    const body = await req.json().catch(() => null)
    const parsed = ChatRequestSchema.safeParse(body)
    if (!parsed.success) return createErrorResponse(400, 'Invalid request')

    const { agentId, messages } = parsed.data
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
  },
  // Chat is a POST but CSRF check with SSE/streaming can be relaxed
  // since the auth guard still validates session + allowlist
  { skipCsrf: false },
)
