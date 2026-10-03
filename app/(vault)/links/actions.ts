'use server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

async function getUserId() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  if (!session.sub) throw new Error('Unauthorized')
  return session.sub
}

export async function createLink(formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  const tagsRaw = formData.get('tags')?.toString() ?? ''
  const tags = tagsRaw
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)

  db.prepare(`
    INSERT INTO links (id, user_id, title, url, description, tags)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(), userId,
    formData.get('title')?.toString() ?? '',
    formData.get('url')?.toString() ?? '',
    formData.get('description')?.toString() || null,
    JSON.stringify(tags),
  )
  revalidatePath('/links')
}

export async function updateLink(id: string, formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  const tagsRaw = formData.get('tags')?.toString() ?? ''
  const tags = tagsRaw
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)

  db.prepare(`
    UPDATE links SET title=?, url=?, description=?, tags=?, updated_at=unixepoch()
    WHERE id=? AND user_id=?
  `).run(
    formData.get('title')?.toString() ?? '',
    formData.get('url')?.toString() ?? '',
    formData.get('description')?.toString() || null,
    JSON.stringify(tags),
    id, userId,
  )
  revalidatePath('/links')
}

export async function deleteLink(id: string) {
  const userId = await getUserId()
  getDb().prepare('DELETE FROM links WHERE id=? AND user_id=?').run(id, userId)
  revalidatePath('/links')
}
