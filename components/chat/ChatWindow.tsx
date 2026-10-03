'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessageBubble } from './MessageBubble'
import { AgentSelector } from './AgentSelector'
import type { ChatMessage, AgentConfigPublic } from '@/lib/ai/types'

interface ChatWindowProps {
  agents:         AgentConfigPublic[]
  defaultAgentId: string
}

interface DisplayMessage {
  role:             'user' | 'assistant'
  content:          string
  thinkingContent?: string
}

/** Fetch the CSRF token from the session once and cache it in module scope. */
let _csrfToken: string | null = null
async function getCsrfToken(): Promise<string> {
  if (_csrfToken) return _csrfToken
  const res = await fetch('/api/csrf', { credentials: 'same-origin' })
  const data = await res.json() as { csrfToken?: string }
  _csrfToken = data.csrfToken ?? ''
  return _csrfToken
}

export function ChatWindow({ agents, defaultAgentId }: ChatWindowProps) {
  const [selectedAgentId, setSelectedAgentId] = useState(defaultAgentId)
  const [messages,        setMessages]         = useState<DisplayMessage[]>([])
  const [input,           setInput]            = useState('')
  const [isStreaming,     setIsStreaming]       = useState(false)
  const [isThinking,      setIsThinking]       = useState(false)   // waiting for first token
  const [thinkingMode,    setThinkingMode]      = useState(false)   // user toggle
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: DisplayMessage   = { role: 'user',      content: text }
    const assistantMsg: DisplayMessage = { role: 'assistant', content: '', thinkingContent: '' }

    const updatedMessages: ChatMessage[] = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ]

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setIsStreaming(true)
    setIsThinking(true)

    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/v1/chat', {
        method:      'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          agentId:  selectedAgentId,
          messages: updatedMessages,
          thinking: thinkingMode,
        }),
      })

      if (!res.ok || !res.body) {
        if (res.status === 403) _csrfToken = null
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: res.status === 403
              ? 'Session expired — please refresh the page.'
              : `Error ${res.status} — something went wrong.` },
        ])
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let assembled      = ''
      let thinkAssembled = ''
      let firstToken     = true

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data) as {
              text?: string; think?: string; error?: string
            }

            if (parsed.error) {
              assembled = parsed.error
              setIsThinking(false)
              setMessages(prev => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: assembled },
              ])
              break
            }

            if (firstToken) { firstToken = false; setIsThinking(false) }

            if (parsed.think) {
              thinkAssembled += parsed.think
              setMessages(prev => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: assembled, thinkingContent: thinkAssembled },
              ])
            }

            if (parsed.text) {
              assembled += parsed.text
              setMessages(prev => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: assembled, thinkingContent: thinkAssembled },
              ])
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection error'
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `⚠️ ${msg}. Please try again.` },
      ])
    } finally {
      setIsStreaming(false)
      setIsThinking(false)
      inputRef.current?.focus()
    }
  }, [input, isStreaming, messages, selectedAgentId, thinkingMode])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header — agent selector + thinking toggle */}
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <AgentSelector
            agents={agents}
            selectedId={selectedAgentId}
            onSelect={id => { setSelectedAgentId(id); setMessages([]) }}
          />
        </div>

        {/* Thinking mode toggle */}
        <button
          type="button"
          onClick={() => setThinkingMode(m => !m)}
          aria-pressed={thinkingMode}
          title={thinkingMode ? 'Thinking mode ON — disable' : 'Enable thinking mode'}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
            thinkingMode
              ? 'border-violet-500 bg-violet-500/20 text-violet-300'
              : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Brain className={`h-3.5 w-3.5 ${thinkingMode ? 'text-violet-400' : ''}`} />
          Think
          {thinkingMode && (
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-zinc-600">Start a conversation. Your messages are private.</p>
            {thinkingMode && (
              <p className="text-xs text-violet-400 flex items-center gap-1">
                <Brain className="h-3 w-3" /> Thinking mode is on — the AI will show its reasoning
              </p>
            )}
          </div>
        )}
        {messages.map((msg, i) => {
          const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant'
          return (
            <MessageBubble
              key={i}
              role={msg.role}
              content={msg.content}
              thinkingContent={msg.thinkingContent}
              isStreaming={isStreaming && isLastAssistant && !isThinking}
              isThinking={isThinking && isLastAssistant}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={thinkingMode
              ? 'Ask anything — AI will reason step by step…'
              : 'Message your agent… (Enter to send, Shift+Enter for new line)'}
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
            style={{ maxHeight: '120px' }}
            aria-label="Chat message"
          />
          <Button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isStreaming}
            size="sm"
            className={`h-11 w-11 shrink-0 rounded-xl p-0 transition-colors disabled:opacity-40 ${
              thinkingMode
                ? 'bg-violet-600 hover:bg-violet-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-zinc-600 flex items-center gap-1.5">
          {thinkingMode
            ? <><Brain className="h-3 w-3 text-violet-500" /> Thinking mode — reasoning shown above each reply</>
            : 'Messages are not stored. Switch agents to reset context.'}
        </p>
      </div>
    </div>
  )
}
