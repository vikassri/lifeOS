import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { randomUUID } from 'crypto'

async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, getSessionOptions())
}

/** POST /api/v1/projects/[id]/folders — create a folder */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const db = getDb()

  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, session.sub)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as { name?: string; parent_id?: string }
  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })

  const id = randomUUID()
  db.prepare(`
    INSERT INTO project_folders (id, project_id, user_id, name, parent_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, projectId, session.sub, name, body.parent_id ?? null)

  const row = db.prepare('SELECT * FROM project_folders WHERE id = ?').get(id)
  return NextResponse.json(row, { status: 201 })
}
