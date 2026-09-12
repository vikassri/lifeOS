import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-emerald-600 text-white rounded-br-sm'
            : 'bg-zinc-800 text-zinc-100 rounded-bl-sm',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 ml-1 bg-current opacity-70 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}
