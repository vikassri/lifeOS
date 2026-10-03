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

export async function createNote(formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  const id = randomUUID()
  const tagsRaw = formData.get('tags')?.toString() ?? ''
  const tags = JSON.stringify(tagsRaw.split(',').map((t) => t.trim()).filter(Boolean))
  db.prepare(`
    INSERT INTO notes (id, user_id, title, content, tags)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, formData.get('title')?.toString() ?? '', formData.get('content')?.toString() ?? '', tags)
  revalidatePath('/notes')
}

export async function updateNote(id: string, formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  const tagsRaw = formData.get('tags')?.toString() ?? ''
  const tags = JSON.stringify(tagsRaw.split(',').map((t) => t.trim()).filter(Boolean))
  db.prepare(`
    UPDATE notes SET
      title = ?,
      content = ?,
      tags = ?,
      updated_at = unixepoch()
    WHERE id = ? AND user_id = ?
  `).run(formData.get('title')?.toString() ?? '', formData.get('content')?.toString() ?? '', tags, id, userId)
  revalidatePath('/notes')
}

export async function deleteNote(id: string) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(id, userId)
  revalidatePath('/notes')
}
