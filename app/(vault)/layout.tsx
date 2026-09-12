// Server component — reads session on server side
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getIronSession } from 'iron-session'
import { getSessionOptions, isSessionValid, type SessionData } from '@/lib/auth/session'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function VaultLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Read session server-side
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())

  if (!isSessionValid(session)) {
    redirect('/login')
  }

  return (
    <DashboardShell userEmail={session.email}>
      {children}
    </DashboardShell>
  )
}
