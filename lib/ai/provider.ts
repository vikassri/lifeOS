import type { ChatMessage } from './types'

// Supports Google Vertex AI (Gemini) and OpenAI-compatible APIs
// Provider selection is based on the model name prefix

function getVertexConfig() {
  const projectId = process.env['GCP_PROJECT_ID']
  const location = process.env['GCP_REGION'] ?? 'asia-southeast1'
  if (!projectId) throw new Error('GCP_PROJECT_ID is not configured')
  return { projectId, location }
}

function getOpenAICompatConfig() {
  const apiKey = process.env['OPENAI_COMPATIBLE_API_KEY'] ?? ''
  const baseUrl = process.env['OPENAI_COMPATIBLE_BASE_URL'] ?? 'https://api.openai.com/v1'
  return { apiKey, baseUrl }
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

export async function* streamChatCompletion(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): AsyncGenerator<string> {
  const isGemini = model.startsWith('gemini-')

  if (isGemini) {
    yield* streamGemini(model, messages, temperature, maxTokens)
  } else {
    yield* streamOpenAICompat(model, messages, temperature, maxTokens)
  }
}

async function* streamGemini(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): AsyncGenerator<string> {
  const { projectId, location } = getVertexConfig()
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:streamGenerateContent`

  // Get access token via Application Default Credentials
  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
  const client = await auth.getClient()
  const token = await client.getAccessToken()

  // Convert messages to Gemini format
  const geminiContents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const systemInstruction = messages.find(m => m.role === 'system')?.content

  const body = {
    contents: geminiContents,
    ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } }),
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // Parse NDJSON chunks from Gemini streaming response
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === '[' || trimmed === ']' || trimmed === ',') continue
      try {
        const clean = trimmed.replace(/^,/, '')
        const chunk = JSON.parse(clean)
        const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) yield text
      } catch {
        // Skip malformed chunks
      }
    }
  }
}

async function* streamOpenAICompat(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): AsyncGenerator<string> {
  const { apiKey, baseUrl } = getOpenAICompatConfig()

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`LLM API error: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

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
        if (content) yield content
      } catch {
        // Skip malformed SSE chunks
      }
    }
  }
}
