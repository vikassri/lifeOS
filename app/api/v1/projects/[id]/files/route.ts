import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { writeProjectFile } from '@/lib/storage/project-files'
import {
  tokensFromSettings,
  ensureProjectFolder,
  uploadToDrive,
} from '@/lib/storage/google-drive'
import { randomUUID } from 'crypto'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

interface SettingsRow {
  google_drive_enabled:  number
  google_access_token:   string | null
  google_refresh_token:  string | null
  google_token_expiry:   number | null
  google_drive_folder_id: string | null
  google_drive_email:    string | null
}

interface ProjectRow { id: string; name: string }

async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, getSessionOptions())
}

/** POST /api/v1/projects/[id]/files — upload a file (local or Drive) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const db = getDb()

  const project = db.prepare('SELECT id, name FROM projects WHERE id = ? AND user_id = ?').get(projectId, session.sub) as ProjectRow | undefined
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const folderId = formData.get('folder_id')?.toString() || null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 413 })

  const fileId = randomUUID()
  const buffer = Buffer.from(await file.arrayBuffer())

  // Check if Google Drive is configured
  const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(session.sub) as SettingsRow | undefined
  const useDrive = settings?.google_drive_enabled === 1 && settings?.google_refresh_token

  if (useDrive && settings) {
    try {
      const tokens = tokensFromSettings(settings)

      // Ensure Life OS / Projects / {project.name} folder exists
      const { rootId, projectId: driveProjFolderId } = await ensureProjectFolder(
        tokens,
        project.name,
        settings.google_drive_folder_id ?? undefined,
      )

      // Save root folder ID for future uploads
      if (!settings.google_drive_folder_id) {
        db.prepare('UPDATE settings SET google_drive_folder_id = ? WHERE user_id = ?').run(rootId, session.sub)
      }

      const driveFileId = await uploadToDrive(tokens, driveProjFolderId, file.name, file.type || 'application/octet-stream', buffer)

      db.prepare(`
        INSERT INTO project_files (id, project_id, folder_id, user_id, original_name, mime_type, size, storage_path, storage_backend, drive_file_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, '', 'drive', ?)
      `).run(fileId, projectId, folderId, session.sub, file.name, file.type || 'application/octet-stream', file.size, driveFileId)

      return NextResponse.json({ id: fileId, original_name: file.name, size: file.size, storage_backend: 'drive' }, { status: 201 })
    } catch (err) {
      console.error('Drive upload failed, falling back to local:', err)
      // Fall through to local storage
    }
  }

  // Local storage fallback
  const storagePath = await writeProjectFile(projectId, fileId, file.name, buffer.buffer as ArrayBuffer)
  db.prepare(`
    INSERT INTO project_files (id, project_id, folder_id, user_id, original_name, mime_type, size, storage_path, storage_backend)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'local')
  `).run(fileId, projectId, folderId, session.sub, file.name, file.type || 'application/octet-stream', file.size, storagePath)

  return NextResponse.json({ id: fileId, original_name: file.name, size: file.size, storage_backend: 'local' }, { status: 201 })
}
