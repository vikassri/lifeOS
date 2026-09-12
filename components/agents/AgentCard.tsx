'use client'

import { useState } from 'react'
import { Pencil, Trash2, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AgentConfigPublic } from '@/lib/ai/types'

interface AgentCardProps {
  agent: AgentConfigPublic
  onEdit: (agent: AgentConfigPublic) => void
  onDelete: (id: string) => void
}

export function AgentCard({ agent, onEdit, onDelete }: AgentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return
    setIsDeleting(true)
    try {
      await fetch(`/api/v1/agents/${agent.id}`, { method: 'DELETE' })
      onDelete(agent.id)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-emerald-400 shrink-0" />
          <h3 className="text-sm font-medium">{agent.name}</h3>
          {agent.isDefault && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
              Default
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(agent)}
            aria-label={`Edit ${agent.name}`}
            className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            aria-label={`Delete ${agent.name}`}
            className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">{agent.description}</p>
      <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
        <span className="rounded bg-zinc-800 px-2 py-0.5">{agent.model}</span>
        <span className="rounded bg-zinc-800 px-2 py-0.5">temp {agent.temperature}</span>
        <span className="rounded bg-zinc-800 px-2 py-0.5">{agent.maxTokens} tokens</span>
        <span className="rounded bg-zinc-800 px-2 py-0.5">ctx {agent.contextWindowSize}</span>
      </div>
      {agent.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agent.tools.map(tool => (
            <span key={tool} className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
              {tool}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
