import { NextResponse, type NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { getSessionOptions, isSessionValid, type SessionData } from '@/lib/auth/session'

// Routes that do NOT require authentication
const PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/login',
  '/api/auth/callback',
  '/api/v1/health',
  '/_next',
  '/favicon.ico',
])

function isPublicPath(pathname: string): boolean {
  for (const path of PUBLIC_PATHS) {
    if (pathname.startsWith(path)) return true
  }
  return false
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl

  // Allow public paths through without auth check
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Validate session
  const res = new NextResponse()
  const session = await getIronSession<SessionData>(req, res, getSessionOptions())

  if (!isSessionValid(session)) {
    const loginUrl = new URL('/login', req.url)
    // Only allow same-origin redirects — prevent open redirect
    loginUrl.searchParams.set('next', pathname.startsWith('/') ? pathname : '/')
    return NextResponse.redirect(loginUrl)
  }

  // Refresh session expiry on each authenticated request (sliding window)
  if (session.exp - Date.now() < 6 * 60 * 60 * 1000) { // less than 6h remaining
    session.exp = Date.now() + 8 * 60 * 60 * 1000
    await session.save()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
