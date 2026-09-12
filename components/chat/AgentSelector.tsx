'use client'

import { ChevronDown } from 'lucide-react'
import type { AgentConfigPublic } from '@/lib/ai/types'

interface AgentSelectorProps {
  agents: AgentConfigPublic[]
  selectedId: string
  onSelect: (id: string) => void
}

export function AgentSelector({ agents, selectedId, onSelect }: AgentSelectorProps) {
  const selected = agents.find(a => a.id === selectedId)

  return (
    <div className="relative">
      <select
        value={selectedId}
        onChange={e => onSelect(e.target.value)}
        className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 pr-8 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
        aria-label="Select agent"
      >
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-zinc-400" />
      {selected && (
        <p className="mt-1 text-xs text-zinc-500">{selected.description}</p>
      )}
    </div>
  )
}
