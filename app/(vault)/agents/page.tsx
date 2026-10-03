import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { listAgents } from '@/lib/ai/agents'
import { AgentsClient } from '@/components/agents/AgentsClient'
import type { AgentConfigPublic } from '@/lib/ai/types'

export default async function AgentsPage() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const agents = await listAgents(session.sub ?? '')

  // Strip userId before passing to client
  const publicAgents: AgentConfigPublic[] = agents.map(({ userId: _u, ...rest }) => rest)

  return <AgentsClient agents={publicAgents} />
}
