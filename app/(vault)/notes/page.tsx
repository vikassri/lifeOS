import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { NotesClient, type NoteRow } from '@/components/notes/NotesClient'

export default async function NotesPage() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const userId = session.sub
  if (!userId) return null

  const db = getDb()
  const notes = db
    .prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC')
    .all(userId) as NoteRow[]

  return <NotesClient notes={notes} />
}
