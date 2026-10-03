import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import {
  ProjectsClient,
  type ProjectRow,
  type ProjectTask,
  type ProjectLink,
  type ProjectFolder,
  type ProjectFile,
} from '@/components/projects/ProjectsClient'

export default async function ProjectsPage() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const userId = session.sub
  if (!userId) return null

  const db = getDb()

  const projectRows = db
    .prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as Omit<ProjectRow, 'tasks' | 'links' | 'folders' | 'files'>[]

  const tasks   = db.prepare('SELECT * FROM project_tasks   WHERE user_id = ? ORDER BY created_at ASC').all(userId) as ProjectTask[]
  const links   = db.prepare('SELECT * FROM project_links   WHERE user_id = ? ORDER BY created_at ASC').all(userId) as ProjectLink[]
  const folders = db.prepare('SELECT * FROM project_folders WHERE user_id = ? ORDER BY created_at ASC').all(userId) as ProjectFolder[]
  const files   = db.prepare('SELECT * FROM project_files   WHERE user_id = ? ORDER BY created_at ASC').all(userId) as ProjectFile[]

  const projects: ProjectRow[] = projectRows.map((p) => ({
    ...p,
    tasks:   tasks.filter((t) => t.project_id === p.id),
    links:   links.filter((l) => l.project_id === p.id),
    folders: folders.filter((f) => f.project_id === p.id),
    files:   files.filter((f) => f.project_id === p.id),
  }))

  return <ProjectsClient projects={projects} />
}
