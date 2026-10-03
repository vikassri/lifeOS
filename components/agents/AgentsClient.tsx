'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Cpu, Pencil, Trash2, Plus, Bot } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import type { AgentConfigPublic } from '@/lib/ai/types'

interface AgentsClientProps {
  agents: AgentConfigPublic[]
}

const MODELS = [
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo',
  'gemini-2.0-flash', 'gemini-1.5-pro',
  'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
  'grok-2', 'llama-3.3-70b-versatile',
]

export function AgentsClient({ agents }: AgentsClientProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editAgent, setEditAgent] = useState<AgentConfigPublic | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [temperature, setTemperature] = useState(0.7)

  const openCreate = () => {
    setEditAgent(null)
    setTemperature(0.7)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (agent: AgentConfigPublic) => {
    setEditAgent(agent)
    setTemperature(agent.temperature)
    setError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditAgent(null)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      description: (form.elements.namedItem('description') as HTMLInputElement).value,
      systemPrompt: (form.elements.namedItem('systemPrompt') as HTMLTextAreaElement).value,
      model: (form.elements.namedItem('model') as HTMLSelectElement).value,
      temperature,
      maxTokens: parseInt((form.elements.namedItem('maxTokens') as HTMLInputElement).value),
    }

    startTransition(async () => {
      try {
        const url = editAgent ? `/api/v1/agents/${editAgent.id}` : '/api/v1/agents'
        const method = editAgent ? 'PUT' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error ?? 'Failed to save agent')
          return
        }
        closeModal()
        router.refresh()
      } catch {
        setError('Network error')
      }
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await fetch(`/api/v1/agents/${id}`, { method: 'DELETE' })
        setDeleteId(null)
        router.refresh()
      } catch {
        setDeleteId(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Agents</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configure personal AI agents — each with its own persona, model, and behaviour.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Agent
        </button>
      </div>

      {/* Agent grid */}
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 py-20 text-center">
          <Bot className="h-10 w-10 text-zinc-600 mb-4" />
          <p className="text-zinc-400">No agents yet.</p>
          <p className="text-zinc-500 text-sm mt-1">Create your first agent to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map(agent => (
            <div key={agent.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3 hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Cpu className="h-4 w-4 text-emerald-400 shrink-0" />
                  <h3 className="text-sm font-medium text-zinc-100 truncate">{agent.name}</h3>
                  {agent.isDefault && (
                    <span className="shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(agent)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                    aria-label={`Edit ${agent.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteId(agent.id)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                    aria-label={`Delete ${agent.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {agent.description && (
                <p className="text-xs text-zinc-500 line-clamp-2">{agent.description}</p>
              )}

              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-zinc-400">{agent.model}</span>
                <span className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-zinc-400">temp {agent.temperature}</span>
                <span className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-zinc-400">{agent.maxTokens} tokens</span>
              </div>

              <div className="pt-1 border-t border-zinc-800">
                <p className="text-xs text-zinc-600 line-clamp-2 font-mono">{agent.systemPrompt}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editAgent ? 'Edit Agent' : 'New Agent'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm text-zinc-300">Name <span className="text-red-400">*</span></label>
            <input
              name="name"
              type="text"
              required
              defaultValue={editAgent?.name ?? ''}
              placeholder="e.g. Finance Advisor"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm text-zinc-300">Description</label>
            <input
              name="description"
              type="text"
              defaultValue={editAgent?.description ?? ''}
              placeholder="Short description of this agent's purpose"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm text-zinc-300">System Prompt <span className="text-red-400">*</span></label>
            <textarea
              name="systemPrompt"
              required
              rows={4}
              defaultValue={editAgent?.systemPrompt ?? ''}
              placeholder="You are a helpful assistant that..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm text-zinc-300">Model</label>
              <select
                name="model"
                defaultValue={editAgent?.model ?? 'gpt-4o-mini'}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
              >
                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm text-zinc-300">Max Tokens</label>
              <input
                name="maxTokens"
                type="number"
                min="256"
                max="32000"
                defaultValue={editAgent?.maxTokens ?? 2048}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-zinc-300">Temperature</label>
              <span className="text-sm font-mono text-zinc-400">{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range" min="0" max="2" step="0.1"
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>0 — Precise</span><span>1 — Balanced</span><span>2 — Creative</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={closeModal}
              className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors">
              {isPending ? 'Saving…' : editAgent ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete Agent">
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Are you sure? This agent and all its configuration will be permanently deleted.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)}
              className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 transition-colors">
              Cancel
            </button>
            <button onClick={() => deleteId && handleDelete(deleteId)} disabled={isPending}
              className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors">
              {isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
