import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { randomUUID } from 'crypto'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import {
  tokensFromSettings, ensureDocumentsFolder, uploadToDrive, getDriveViewLink,
} from '@/lib/storage/google-drive'

const MAX_SIZE = 100 * 1024 * 1024 // 100 MB

interface DriveSettings {
  google_drive_enabled:   number
  google_access_token:    string | null
  google_refresh_token:   string | null
  google_token_expiry:    number | null
  google_drive_folder_id: string | null
}

async function getSession() {
  const cs = await cookies()
  return getIronSession<SessionData>(cs, getSessionOptions())
}

// ── GET — list all document files ────────────────────────────────────────────
export async function GET() {
  const session = await getSession()
  if (!session.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const files = db
    .prepare('SELECT * FROM document_files WHERE user_id = ? ORDER BY created_at DESC')
    .all(session.sub)

  return NextResponse.json({ files })
}

// ── POST — upload file to Drive ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const settings = db
    .prepare('SELECT google_drive_enabled, google_access_token, google_refresh_token, google_token_expiry, google_drive_folder_id FROM settings WHERE user_id = ?')
    .get(session.sub) as DriveSettings | undefined

  const driveEnabled = settings?.google_drive_enabled === 1 && !!settings?.google_refresh_token
  if (!driveEnabled) {
    return NextResponse.json({ error: 'Google Drive is not connected. Go to Settings to connect.' }, { status: 400 })
  }

  let formData: FormData
  try { formData = await req.formData() }
  catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }) }

  const file     = formData.get('file')     as File | null
  const category = formData.get('category') as string ?? 'general'

  if (!file)           return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 100 MB)' }, { status: 413 })

  try {
    const tokens = tokensFromSettings(settings!)
    const { rootId, documentsId } = await ensureDocumentsFolder(tokens, settings!.google_drive_folder_id ?? undefined)

    // Save root ID for future calls
    if (!settings!.google_drive_folder_id) {
      db.prepare('UPDATE settings SET google_drive_folder_id = ? WHERE user_id = ?').run(rootId, session.sub)
    }

    const buffer      = Buffer.from(await file.arrayBuffer())
    const driveFileId = await uploadToDrive(tokens, documentsId, file.name, file.type || 'application/octet-stream', buffer)
    const viewLink    = await getDriveViewLink(tokens, driveFileId)

    const id = randomUUID()
    db.prepare(`
      INSERT INTO document_files (id, user_id, name, mime_type, size, category, storage_backend, drive_file_id, drive_view_link)
      VALUES (?, ?, ?, ?, ?, ?, 'drive', ?, ?)
    `).run(id, session.sub, file.name, file.type || 'application/octet-stream', file.size, category, driveFileId, viewLink)

    const record = db.prepare('SELECT * FROM document_files WHERE id = ?').get(id)
    return NextResponse.json({ file: record }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
