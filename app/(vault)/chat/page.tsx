import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getIronSession } from 'iron-session'
import { getSessionOptions, isSessionValid, type SessionData } from '@/lib/auth/session'
import { listAgents, seedDefaultAgents } from '@/lib/ai/agents'
import { ChatWindow } from '@/components/chat/ChatWindow'
import type { AgentConfigPublic } from '@/lib/ai/types'

export default async function ChatPage() {
  const cookieStore = cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  if (!isSessionValid(session)) redirect('/login')

  // Seed default agents on first visit
  await seedDefaultAgents(session.sub)

  const agents = await listAgents(session.sub)
  const publicAgents: AgentConfigPublic[] = agents.map(({ userId: _userId, ...rest }) => rest)
  const defaultAgent = publicAgents.find(a => a.isDefault) ?? publicAgents[0]

  if (!defaultAgent || publicAgents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-zinc-500">No agents configured.</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Chat</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Your private AI assistant. Messages are not stored.
        </p>
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <ChatWindow agents={publicAgents} defaultAgentId={defaultAgent.id} />
      </div>
    </div>
  )
}
