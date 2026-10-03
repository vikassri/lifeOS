import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getAuthUrl } from '@/lib/storage/google-drive'

/** GET /api/v1/storage/google-auth — redirect user to Google OAuth consent screen */
export async function GET() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  if (!session.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env['GOOGLE_CLIENT_ID']
  if (!clientId) {
    return NextResponse.redirect(
      new URL('/settings?error=google_not_configured', process.env['NEXTAUTH_URL'] ?? 'http://localhost:3000')
    )
  }

  const authUrl = getAuthUrl()
  return NextResponse.redirect(authUrl)
}
