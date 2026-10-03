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

export async function createProject(formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO projects (id, user_id, name, description, status, due_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    formData.get('name')?.toString() ?? '',
    formData.get('description')?.toString() || null,
    formData.get('status')?.toString() || 'active',
    formData.get('due_date')?.toString() || null,
  )
  revalidatePath('/projects')
}

export async function updateProject(id: string, formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare(`
    UPDATE projects SET
      name = ?,
      description = ?,
      status = ?,
      due_date = ?,
      updated_at = unixepoch()
    WHERE id = ? AND user_id = ?
  `).run(
    formData.get('name')?.toString() ?? '',
    formData.get('description')?.toString() || null,
    formData.get('status')?.toString() || 'active',
    formData.get('due_date')?.toString() || null,
    id,
    userId,
  )
  revalidatePath('/projects')
}

export async function deleteProject(id: string) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, userId)
  revalidatePath('/projects')
}

export async function addTask(projectId: string, title: string) {
  const userId = await getUserId()
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO project_tasks (id, project_id, user_id, title)
    VALUES (?, ?, ?, ?)
  `).run(id, projectId, userId, title)
  revalidatePath('/projects')
}

export async function toggleTask(taskId: string) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare(`
    UPDATE project_tasks SET done = CASE WHEN done = 0 THEN 1 ELSE 0 END
    WHERE id = ? AND user_id = ?
  `).run(taskId, userId)
  revalidatePath('/projects')
}

export async function deleteTask(taskId: string) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare('DELETE FROM project_tasks WHERE id = ? AND user_id = ?').run(taskId, userId)
  revalidatePath('/projects')
}

export async function addProjectLink(projectId: string, title: string, url: string) {
  const userId = await getUserId()
  if (!title.trim() || !url.trim()) return
  // Normalise — prepend https:// if no protocol given
  const normUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO project_links (id, project_id, user_id, title, url)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, projectId, userId, title.trim(), normUrl)
  revalidatePath('/projects')
}

export async function deleteProjectLink(linkId: string) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare('DELETE FROM project_links WHERE id = ? AND user_id = ?').run(linkId, userId)
  revalidatePath('/projects')
}
