'use server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

async function getUserId(): Promise<string> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const userId = session.sub
  if (!userId) throw new Error('Unauthorized')
  return userId
}

export async function createEntry(formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO journal_entries (id, user_id, title, content, mood, entry_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    formData.get('title')?.toString() ?? '',
    formData.get('content')?.toString() ?? '',
    formData.get('mood')?.toString() || null,
    formData.get('entry_date')?.toString() || new Date().toISOString().slice(0, 10),
  )
  revalidatePath('/journal')
}

export async function updateEntry(id: string, formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare(`
    UPDATE journal_entries SET
      title = ?,
      content = ?,
      mood = ?,
      entry_date = ?,
      updated_at = unixepoch()
    WHERE id = ? AND user_id = ?
  `).run(
    formData.get('title')?.toString() ?? '',
    formData.get('content')?.toString() ?? '',
    formData.get('mood')?.toString() || null,
    formData.get('entry_date')?.toString() || new Date().toISOString().slice(0, 10),
    id,
    userId,
  )
  revalidatePath('/journal')
}

export async function deleteEntry(id: string) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare('DELETE FROM journal_entries WHERE id = ? AND user_id = ?').run(id, userId)
  revalidatePath('/journal')
}
