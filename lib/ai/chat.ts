import { getAgent } from './agents'
import { streamChatCompletion, buildMessages, trimToContextWindow, type ProviderConfig, type StreamChunk } from './provider'
import type { ChatMessage } from './types'
import { ApiError } from '@/lib/errors/api-error'
import { getDb } from '@/lib/db/client'

interface SettingsRow {
  provider:        string | null
  openai_api_key:  string | null
  openai_base_url: string | null
  ollama_base_url: string | null
  default_model:   string | null
}

/** Build a ProviderConfig from the user's stored settings.
 *
 * Model resolution order:
 *   1. settings.default_model  — what the user explicitly chose in Settings
 *   2. agentModel              — the per-agent override (fallback)
 */
function buildProviderConfig(settings: SettingsRow, agentModel: string): ProviderConfig {
  const provider = settings.provider ?? 'openai'
  const model    = settings.default_model?.trim() || agentModel

  return {
    provider,
    apiKey:  settings.openai_api_key ?? '',
    baseUrl: provider === 'ollama'
               ? (settings.ollama_base_url ?? 'http://localhost:11434')
               : (settings.openai_base_url ?? 'https://api.openai.com/v1'),
    model,
  }
}

export async function* streamChat(
  userId: string,
  agentId: string,
  messages: ChatMessage[],
  thinking = false,
): AsyncGenerator<StreamChunk> {
  const agent = await getAgent(userId, agentId)
  if (!agent) throw new ApiError(404, 'Agent not found')
  if (agent.userId !== userId) throw new ApiError(403, 'Access denied')

  // Read the user's AI provider settings from DB
  const db = getDb()
  const settings = db
    .prepare('SELECT provider, openai_api_key, openai_base_url, ollama_base_url, default_model FROM settings WHERE user_id = ?')
    .get(userId) as SettingsRow | undefined

  if (!settings) {
    yield { type: 'text', content: '⚠️ No settings found. Please visit **Settings** and configure your AI provider.' }
    return
  }

  const config = buildProviderConfig(settings, agent.model)
  const trimmed = trimToContextWindow(messages, agent.contextWindowSize)
  const fullMessages = buildMessages(agent.systemPrompt, trimmed)

  yield* streamChatCompletion(config, fullMessages, agent.temperature, agent.maxTokens, thinking)
}
