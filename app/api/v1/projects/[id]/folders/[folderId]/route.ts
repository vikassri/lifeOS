import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { deleteProjectFile } from '@/lib/storage/project-files'

async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, getSessionOptions())
}

interface FileRow { storage_path: string }

/** DELETE /api/v1/projects/[id]/folders/[folderId] — remove folder + all its files */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> },
) {
  const session = await getSession()
  if (!session.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId, folderId } = await params
  const db = getDb()

  const folder = db.prepare(
    'SELECT id FROM project_folders WHERE id = ? AND project_id = ? AND user_id = ?'
  ).get(folderId, projectId, session.sub)
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete files on disk
  const files = db.prepare('SELECT storage_path FROM project_files WHERE folder_id = ?').all(folderId) as FileRow[]
  for (const f of files) deleteProjectFile(f.storage_path)

  // DB cascade deletes the files rows
  db.prepare('DELETE FROM project_folders WHERE id = ?').run(folderId)

  return NextResponse.json({ success: true })
}
