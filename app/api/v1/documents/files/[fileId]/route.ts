import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { tokensFromSettings, downloadFromDrive, deleteFromDrive } from '@/lib/storage/google-drive'

interface DocFileRow {
  id: string; user_id: string; name: string; mime_type: string
  size: number; category: string; storage_backend: string
  drive_file_id: string | null; drive_view_link: string | null; created_at: number
}
interface DriveSettings {
  google_access_token: string | null; google_refresh_token: string | null; google_token_expiry: number | null
}

async function getSession() {
  const cs = await cookies()
  return getIronSession<SessionData>(cs, getSessionOptions())
}

// ── GET — download file ───────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await getSession()
  if (!session.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fileId } = await params
  const db  = getDb()
  const row = db.prepare('SELECT * FROM document_files WHERE id = ? AND user_id = ?').get(fileId, session.sub) as DocFileRow | undefined
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (row.storage_backend === 'drive' && row.drive_file_id) {
    const settings = db.prepare('SELECT google_access_token, google_refresh_token, google_token_expiry FROM settings WHERE user_id = ?').get(session.sub) as DriveSettings | undefined
    if (!settings) return NextResponse.json({ error: 'Drive not configured' }, { status: 400 })

    const buf = await downloadFromDrive(tokensFromSettings(settings), row.drive_file_id)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type':        row.mime_type,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(row.name)}"`,
        'Content-Length':      String(buf.length),
      },
    })
  }

  return NextResponse.json({ error: 'File not accessible' }, { status: 404 })
}

// ── DELETE — remove from Drive + DB ─────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await getSession()
  if (!session.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fileId } = await params
  const db  = getDb()
  const row = db.prepare('SELECT * FROM document_files WHERE id = ? AND user_id = ?').get(fileId, session.sub) as DocFileRow | undefined
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete from Drive (best-effort)
  if (row.drive_file_id) {
    const settings = db.prepare('SELECT google_access_token, google_refresh_token, google_token_expiry FROM settings WHERE user_id = ?').get(session.sub) as DriveSettings | undefined
    if (settings) {
      await deleteFromDrive(tokensFromSettings(settings), row.drive_file_id).catch(() => {})
    }
  }

  db.prepare('DELETE FROM document_files WHERE id = ?').run(fileId)
  return NextResponse.json({ ok: true })
}
