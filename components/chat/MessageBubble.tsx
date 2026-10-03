'use client'
import { useState } from 'react'
import { ChevronDown, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  role:             'user' | 'assistant'
  content:          string
  thinkingContent?: string   // reasoning / chain-of-thought
  isStreaming?:     boolean  // tokens arriving
  isThinking?:      boolean  // waiting for first token (dots)
}

/** Three bouncing dots — shown while waiting for first token. */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5" aria-label="Thinking…">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-zinc-400"
          style={{
            animation:      'typingBounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes typingBounce {
          0%,60%,100% { transform:translateY(0);    opacity:.4 }
          30%         { transform:translateY(-6px);  opacity:1  }
        }
      `}</style>
    </span>
  )
}

/** Collapsible reasoning block shown above the assistant answer. */
function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-2 rounded-lg border border-violet-500/20 bg-violet-950/30 text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-violet-300 hover:bg-violet-500/10 transition-colors"
        aria-expanded={open}
      >
        <Brain className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium tracking-wide">Reasoning</span>
        {isStreaming && (
          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
        )}
        <ChevronDown className={cn(
          'ml-auto h-3.5 w-3.5 transition-transform',
          open ? 'rotate-180' : '',
        )} />
      </button>
      {open && (
        <div className="border-t border-violet-500/10 px-3 py-2 max-h-60 overflow-y-auto">
          <p className="whitespace-pre-wrap text-violet-200/70 leading-relaxed font-mono text-[11px]">
            {content}
            {isStreaming && (
              <span
                className="inline-block h-3 w-0.5 ml-0.5 rounded-sm bg-violet-400 align-middle"
                style={{ animation: 'cursorBlink .8s step-end infinite' }}
              />
            )}
          </p>
        </div>
      )}
    </div>
  )
}

export function MessageBubble({
  role, content, thinkingContent, isStreaming, isThinking,
}: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex w-full items-end gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400 select-none">
          AI
        </div>
      )}

      <div className={cn('max-w-[78%]', isUser && 'flex flex-col items-end')}>
        {/* Reasoning block — assistant only */}
        {!isUser && thinkingContent && (
          <ThinkingBlock content={thinkingContent} isStreaming={isStreaming && !content} />
        )}

        {/* Main bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-emerald-600 text-white rounded-br-sm'
              : 'bg-zinc-800 text-zinc-100 rounded-bl-sm',
          )}
        >
          {/* Waiting dots */}
          {isThinking && !content && <TypingDots />}

          {/* Content */}
          {content && (
            <>
              <p className="whitespace-pre-wrap break-words">{content}</p>
              {isStreaming && (
                <span
                  className="inline-block h-4 w-1 ml-0.5 rounded-sm bg-emerald-400 align-middle"
                  style={{ animation: 'cursorBlink .8s step-end infinite' }}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300 select-none">
          U
        </div>
      )}

      <style>{`
        @keyframes cursorBlink {
          0%,100% { opacity:1 } 50% { opacity:0 }
        }
      `}</style>
    </div>
  )
}
