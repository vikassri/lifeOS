import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { exchangeCode } from '@/lib/storage/google-drive'
import { getDb } from '@/lib/db/client'

const BASE_URL = process.env['NEXTAUTH_URL'] ?? 'http://localhost:3000'

/** GET /api/v1/storage/google-callback?code=... — receive OAuth code, save tokens */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  if (!session.sub) return NextResponse.redirect(new URL('/login', BASE_URL))

  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/settings?tab=storage&error=google_denied', BASE_URL))
  }

  try {
    const { access_token, refresh_token, expiry_date, email } = await exchangeCode(code)

    const db = getDb()

    // Upsert settings row
    db.prepare(`
      INSERT INTO settings (id, user_id, google_drive_enabled, google_access_token, google_refresh_token, google_token_expiry, google_drive_email)
      VALUES (?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        google_drive_enabled  = 1,
        google_access_token   = excluded.google_access_token,
        google_refresh_token  = COALESCE(excluded.google_refresh_token, google_refresh_token),
        google_token_expiry   = excluded.google_token_expiry,
        google_drive_email    = excluded.google_drive_email,
        updated_at            = unixepoch()
    `).run(
      crypto.randomUUID(),
      session.sub,
      access_token   ?? null,
      refresh_token  ?? null,
      expiry_date    ?? null,
      email,
    )

    return NextResponse.redirect(new URL('/settings?tab=storage&success=google_connected', BASE_URL))
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(new URL('/settings?tab=storage&error=google_failed', BASE_URL))
  }
}
