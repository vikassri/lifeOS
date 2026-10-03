// Server component — reads session on server side
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getIronSession } from 'iron-session'
import { getSessionOptions, isSessionValid, type SessionData } from '@/lib/auth/session'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { getDb } from '@/lib/db/client'
import { getAuthorizedUser } from '@/lib/auth/local-auth'
import { isAuthorizedEmail } from '@/lib/auth/allowlist'

export default async function VaultLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Read session server-side
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())

  if (!isSessionValid(session) || !isAuthorizedEmail(session.email)) {
    redirect('/login')
  }

  // Ensure user row always exists — safe to run on every request (ON CONFLICT DO NOTHING)
  // Protects against DB resets while a session cookie is still valid
  const user = getAuthorizedUser()
  const db = getDb()
  db.prepare(`
    INSERT INTO users (id, email, name) VALUES (?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(user.id, user.email, user.name)

  return (
    <DashboardShell userName={user.name}>
      {children}
    </DashboardShell>
  )
}
