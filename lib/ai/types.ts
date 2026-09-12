export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type AgentTool = 'web_search' | 'calculator' | 'date_time' | 'vault_search'

export interface AgentConfig {
  id: string
  userId: string
  name: string
  description: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  contextWindowSize: number
  tools: AgentTool[]
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

export type AgentConfigInput = Omit<AgentConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

export interface ChatRequest {
  agentId: string
  messages: ChatMessage[]
}

// Safe agent view — strips internal userId for API responses
export type AgentConfigPublic = Omit<AgentConfig, 'userId'>
