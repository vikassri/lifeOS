import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getIronSession } from 'iron-session'
import { getSessionOptions, isSessionValid, type SessionData } from '@/lib/auth/session'
import { listAgents } from '@/lib/ai/agents'
import { AgentCard } from '@/components/agents/AgentCard'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import type { AgentConfigPublic } from '@/lib/ai/types'

export default async function AgentsPage() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  if (!isSessionValid(session)) redirect('/login')
  const agents = await listAgents(session.sub)
  const publicAgents: AgentConfigPublic[] = agents.map(({ userId: _userId, ...rest }) => rest)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configure your personal AI agents. Each agent has its own persona, model, and behavior.
          </p>
        </div>
        <Link
          href="/agents/new"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          New Agent
        </Link>
      </div>

      {publicAgents.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-zinc-500">No agents yet. Create your first agent.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publicAgents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  )
}
