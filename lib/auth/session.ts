import { getIronSession, type IronSession } from 'iron-session'
import type { NextRequest } from 'next/server'

export interface SessionData {
  sub: string           // Google subject ID
  email: string
  iat: number           // issued at (ms)
  exp: number           // expires at (ms)
  stepUpExpiry: number | null  // step-up auth window
  csrfToken?: string    // CSRF token bound to session
  // OAuth PKCE state (temporary — cleared after callback)
  oauthState?: string
  oauthCodeVerifier?: string
  oauthStateExpiry?: number
}

function getSessionSecret(): string {
  const secret = process.env['SESSION_SECRET']
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters')
  }
  return secret
}

export function getSessionOptions() {
  return {
    cookieName: 'life-os-session',
    password: getSessionSecret(),
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 8 * 60 * 60, // 8 hours in seconds
      path: '/',
    },
  }
}

export async function getSession(req: NextRequest): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(req, new Response(), getSessionOptions())
}

export function isSessionExpired(session: SessionData): boolean {
  return Date.now() > session.exp
}

export function isSessionValid(session: Partial<SessionData>): session is SessionData {
  return (
    typeof session.sub === 'string' &&
    session.sub.length > 0 &&
    typeof session.email === 'string' &&
    typeof session.exp === 'number' &&
    !isSessionExpired(session as SessionData)
  )
}
