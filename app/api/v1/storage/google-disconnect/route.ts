import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'

/** POST /api/v1/storage/google-disconnect — revoke Drive access */
export async function POST() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  if (!session.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  db.prepare(`
    UPDATE settings SET
      google_drive_enabled  = 0,
      google_access_token   = NULL,
      google_refresh_token  = NULL,
      google_token_expiry   = NULL,
      google_drive_folder_id = NULL,
      google_drive_email    = NULL,
      updated_at            = unixepoch()
    WHERE user_id = ?
  `).run(session.sub)

  return NextResponse.json({ success: true })
}
