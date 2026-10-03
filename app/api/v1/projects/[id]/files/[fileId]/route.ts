import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { readProjectFile, deleteProjectFile } from '@/lib/storage/project-files'
import { tokensFromSettings, downloadFromDrive, deleteFromDrive } from '@/lib/storage/google-drive'

async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, getSessionOptions())
}

interface FileRow {
  id: string; project_id: string; user_id: string
  original_name: string; mime_type: string; size: number
  storage_path: string; storage_backend: string; drive_file_id: string | null
}

interface SettingsRow {
  google_access_token:  string | null
  google_refresh_token: string | null
  google_token_expiry:  number | null
}

/** GET /api/v1/projects/[id]/files/[fileId] — stream file (local or Drive) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const session = await getSession()
  if (!session.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId, fileId } = await params
  const db = getDb()

  const file = db.prepare(
    'SELECT * FROM project_files WHERE id = ? AND project_id = ? AND user_id = ?'
  ).get(fileId, projectId, session.sub) as FileRow | undefined

  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    let buffer: Buffer

    if (file.storage_backend === 'drive' && file.drive_file_id) {
      const settings = db.prepare(
        'SELECT google_access_token, google_refresh_token, google_token_expiry FROM settings WHERE user_id = ?'
      ).get(session.sub) as SettingsRow | undefined

      if (!settings?.google_refresh_token) {
        return NextResponse.json({ error: 'Google Drive not connected' }, { status: 503 })
      }
      buffer = await downloadFromDrive(tokensFromSettings(settings), file.drive_file_id)
    } else {
      buffer = await readProjectFile(file.storage_path)
    }

    return new NextResponse(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': file.mime_type,
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.original_name)}"`,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}

/** DELETE /api/v1/projects/[id]/files/[fileId] — remove file (local or Drive) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const session = await getSession()
  if (!session.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId, fileId } = await params
  const db = getDb()

  const file = db.prepare(
    'SELECT * FROM project_files WHERE id = ? AND project_id = ? AND user_id = ?'
  ).get(fileId, projectId, session.sub) as FileRow | undefined

  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (file.storage_backend === 'drive' && file.drive_file_id) {
    const settings = db.prepare(
      'SELECT google_access_token, google_refresh_token, google_token_expiry FROM settings WHERE user_id = ?'
    ).get(session.sub) as SettingsRow | undefined

    if (settings?.google_refresh_token) {
      await deleteFromDrive(tokensFromSettings(settings), file.drive_file_id)
    }
  } else {
    deleteProjectFile(file.storage_path)
  }

  db.prepare('DELETE FROM project_files WHERE id = ?').run(fileId)
  return NextResponse.json({ success: true })
}
