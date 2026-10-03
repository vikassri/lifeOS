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

export async function createDocument(formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO documents (id, user_id, title, content, category)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    formData.get('title')?.toString() ?? '',
    formData.get('content')?.toString() ?? '',
    formData.get('category')?.toString() || 'general',
  )
  revalidatePath('/documents')
}

export async function updateDocument(id: string, formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare(`
    UPDATE documents SET
      title = ?,
      content = ?,
      category = ?,
      updated_at = unixepoch()
    WHERE id = ? AND user_id = ?
  `).run(
    formData.get('title')?.toString() ?? '',
    formData.get('content')?.toString() ?? '',
    formData.get('category')?.toString() || 'general',
    id,
    userId,
  )
  revalidatePath('/documents')
}

export async function deleteDocument(id: string) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').run(id, userId)
  revalidatePath('/documents')
}
