import { getAgent } from './agents'
import { streamChatCompletion, buildMessages, trimToContextWindow } from './provider'
import type { ChatMessage } from './types'
import { ApiError } from '@/lib/errors/api-error'

export async function* streamChat(
  userId: string,
  agentId: string,
  messages: ChatMessage[],
): AsyncGenerator<string> {
  const agent = await getAgent(userId, agentId)
  if (!agent) throw new ApiError(404, 'Agent not found')
  if (agent.userId !== userId) throw new ApiError(403, 'Access denied')

  const trimmed = trimToContextWindow(messages, agent.contextWindowSize)
  const fullMessages = buildMessages(agent.systemPrompt, trimmed)

  yield* streamChatCompletion(
    agent.model,
    fullMessages,
    agent.temperature,
    agent.maxTokens,
  )
}
