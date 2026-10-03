import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { JournalClient, type JournalEntry } from '@/components/journal/JournalClient'

export default async function JournalPage() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const userId = session.sub
  if (!userId) return null

  const db = getDb()
  const entries = db
    .prepare('SELECT * FROM journal_entries WHERE user_id = ? ORDER BY entry_date DESC, created_at DESC')
    .all(userId) as JournalEntry[]

  return <JournalClient entries={entries} />
}
