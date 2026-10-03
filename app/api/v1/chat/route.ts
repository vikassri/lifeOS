import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/middleware/api-guard'
import { streamChat } from '@/lib/ai/chat'
import { createErrorResponse } from '@/lib/errors/api-error'
import type { SessionData } from '@/lib/auth/session'

const ChatRequestSchema = z.object({
  agentId:  z.string().uuid(),
  thinking: z.boolean().optional().default(false),
  messages: z.array(
    z.object({
      role:    z.enum(['user', 'assistant']),
      content: z.string().max(10_000),
    }),
  ).min(1).max(50),
})

export const POST = withApiGuard(
  async (req: NextRequest, { session }: { session: SessionData }) => {
    const body   = await req.json().catch(() => null)
    const parsed = ChatRequestSchema.safeParse(body)
    if (!parsed.success) return createErrorResponse(400, 'Invalid request')

    const { agentId, messages, thinking } = parsed.data
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamChat(session.sub ?? '', agentId, messages, thinking)) {
            // Emit typed SSE events: { text } for answer, { think } for reasoning
            const event = chunk.type === 'think'
              ? JSON.stringify({ think: chunk.content })
              : JSON.stringify({ text:  chunk.content })
            controller.enqueue(encoder.encode(`data: ${event}\n\n`))
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
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection:      'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  },
  { skipCsrf: false },
)
