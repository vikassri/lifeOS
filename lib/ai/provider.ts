import type { ChatMessage } from './types'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ProviderConfig {
  provider: string
  apiKey:   string
  baseUrl:  string
  model:    string
}

/** Every chunk in the stream is either reasoning ('think') or the final answer ('text'). */
export interface StreamChunk {
  type:    'think' | 'text'
  content: string
}

// ── URL resolution ────────────────────────────────────────────────────────────
export function resolveBaseUrl(config: ProviderConfig): string {
  switch (config.provider) {
    case 'openai':    return 'https://api.openai.com/v1'
    case 'gemini':    return 'https://generativelanguage.googleapis.com/v1beta/openai'
    case 'grok':      return 'https://api.x.ai/v1'
    case 'groq':      return 'https://api.groq.com/openai/v1'
    case 'anthropic': return 'https://api.anthropic.com/v1'
    case 'ollama':    return config.baseUrl.replace(/\/$/, '') + '/v1'
    default:          return config.baseUrl.replace(/\/+$/, '')
  }
}

export function buildMessages(
  systemPrompt: string,
  messages: ChatMessage[],
): ChatMessage[] {
  return [{ role: 'system', content: systemPrompt }, ...messages]
}

export function trimToContextWindow(
  messages: ChatMessage[],
  windowSize: number,
): ChatMessage[] {
  if (messages.length <= windowSize) return messages
  return messages.slice(messages.length - windowSize)
}

// ── Main entry ────────────────────────────────────────────────────────────────
export async function* streamChatCompletion(
  config: ProviderConfig,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  thinking = false,
): AsyncGenerator<StreamChunk> {
  if (!config.apiKey && config.provider !== 'ollama' && config.provider !== 'custom') {
    yield { type: 'text', content: `⚠️ No API key configured for **${config.provider}**. Go to Settings → AI Provider and add your key.` }
    return
  }

  if (config.provider === 'anthropic') {
    yield* streamAnthropic(config, messages, temperature, maxTokens, thinking)
  } else {
    yield* streamOpenAICompat(config, messages, temperature, maxTokens, thinking)
  }
}

// ── OpenAI-compatible ─────────────────────────────────────────────────────────
async function* streamOpenAICompat(
  config: ProviderConfig,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  thinking: boolean,
): AsyncGenerator<StreamChunk> {
  const baseUrl = resolveBaseUrl(config)

  // Inject thinking instruction into system prompt for providers that don't natively
  // support thinking but can follow the <think> convention (Ollama, Groq, etc.)
  const finalMessages = thinking
    ? injectThinkingPrompt(messages)
    : messages

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: finalMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  })

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '')
    throw new Error(`LLM API error ${response.status}: ${errText.slice(0, 200)}`)
  }

  // Stream raw text then split on <think> tags
  if (thinking) {
    yield* splitThinkTags(parseSseTextStream(response.body))
  } else {
    for await (const text of parseSseTextStream(response.body)) {
      yield { type: 'text', content: text }
    }
  }
}

// ── Anthropic — native extended thinking ─────────────────────────────────────
async function* streamAnthropic(
  config: ProviderConfig,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  thinking: boolean,
): AsyncGenerator<StreamChunk> {
  const system  = messages.find(m => m.role === 'system')?.content ?? ''
  const history = messages.filter(m => m.role !== 'system')

  const body: Record<string, unknown> = {
    model: config.model,
    system,
    messages: history,
    max_tokens: thinking ? Math.max(maxTokens, 8000) : maxTokens, // thinking needs head room
    temperature: thinking ? 1 : temperature, // Anthropic requires temp=1 for thinking
    stream: true,
  }

  if (thinking) {
    body.thinking = { type: 'enabled', budget_tokens: 5000 }
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 200)}`)
  }

  const reader  = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''
  let currentBlockType: 'thinking' | 'text' | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)

      try {
        const ev = JSON.parse(data)

        // Track which block we are in
        if (ev.type === 'content_block_start') {
          currentBlockType = ev.content_block?.type === 'thinking' ? 'thinking' : 'text'
        }

        // Yield delta content with correct chunk type
        if (ev.type === 'content_block_delta') {
          if (ev.delta?.type === 'thinking_delta' && ev.delta.thinking) {
            yield { type: 'think', content: ev.delta.thinking as string }
          } else if (ev.delta?.type === 'text_delta' && ev.delta.text) {
            yield { type: 'text', content: ev.delta.text as string }
          }
        }

        if (ev.type === 'content_block_stop') {
          currentBlockType = null
        }
      } catch { /* skip malformed events */ }
    }
  }

  void currentBlockType // suppress unused warning
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Prepend a thinking instruction to the system message.
 * Used for providers that don't natively support thinking but can follow conventions.
 */
function injectThinkingPrompt(messages: ChatMessage[]): ChatMessage[] {
  const THINK_INSTRUCTION = `Before answering, work through your reasoning inside <think>…</think> tags. Be thorough. Your final response should come after the closing </think> tag.`

  return messages.map(m => {
    if (m.role !== 'system') return m
    return { ...m, content: `${THINK_INSTRUCTION}\n\n${m.content}` }
  })
}

/**
 * Parse a raw SSE stream body into text strings (OpenAI delta format).
 */
async function* parseSseTextStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader  = body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') return
      try {
        const chunk = JSON.parse(data)
        const content = chunk?.choices?.[0]?.delta?.content
        if (content) yield content as string
      } catch { /* skip */ }
    }
  }
}

/**
 * Split a raw text stream on <think>…</think> tags and emit typed StreamChunks.
 * Works character-by-character so it handles chunks that split mid-tag.
 */
async function* splitThinkTags(src: AsyncGenerator<string>): AsyncGenerator<StreamChunk> {
  let inThink = false
  let buf     = ''               // partial tag accumulation buffer

  for await (const raw of src) {
    buf += raw

    while (buf.length > 0) {
      if (!inThink) {
        const open = buf.indexOf('<think>')
        if (open === -1) {
          // No opening tag yet — check if the tail might be a partial tag start
          const tail = longestSuffix(buf, '<think>')
          if (tail > 0) {
            // Flush everything except the potential partial tag
            if (buf.length > tail) {
              yield { type: 'text', content: buf.slice(0, buf.length - tail) }
              buf = buf.slice(buf.length - tail)
            }
            break   // wait for more data
          } else {
            yield { type: 'text', content: buf }
            buf = ''
          }
        } else {
          if (open > 0) yield { type: 'text', content: buf.slice(0, open) }
          buf     = buf.slice(open + 7)   // skip '<think>'
          inThink = true
        }
      } else {
        const close = buf.indexOf('</think>')
        if (close === -1) {
          const tail = longestSuffix(buf, '</think>')
          if (tail > 0) {
            if (buf.length > tail) {
              yield { type: 'think', content: buf.slice(0, buf.length - tail) }
              buf = buf.slice(buf.length - tail)
            }
            break
          } else {
            yield { type: 'think', content: buf }
            buf = ''
          }
        } else {
          if (close > 0) yield { type: 'think', content: buf.slice(0, close) }
          buf     = buf.slice(close + 8)  // skip '</think>'
          inThink = false
        }
      }
    }
  }

  // Flush any remaining buffer
  if (buf.length > 0) {
    yield { type: inThink ? 'think' : 'text', content: buf }
  }
}

/** How many chars of `buf`'s tail could be a partial prefix of `tag`. */
function longestSuffix(buf: string, tag: string): number {
  for (let len = Math.min(buf.length, tag.length - 1); len > 0; len--) {
    if (buf.endsWith(tag.slice(0, len))) return len
  }
  return 0
}
