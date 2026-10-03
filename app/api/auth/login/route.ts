import { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { verifyPassword, getAuthorizedUser, isAuthorizedUsername } from '@/lib/auth/local-auth'
import { generateCsrfToken } from '@/lib/security/csrf'
import { writeAuditEvent } from '@/lib/audit/log'
import { authRateLimiter } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// Handles both plain HTML form POST (Content-Type: application/x-www-form-urlencoded)
// and JSON fetch POST (Content-Type: application/json)
export async function POST(req: NextRequest): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const isFormPost = req.headers.get('content-type')?.includes('application/x-www-form-urlencoded')

  // Rate limit
  const allowed = authRateLimiter(ip)
  if (!allowed) {
    if (isFormPost) {
      return Response.redirect(new URL('/login?error=too_many_attempts', req.url), 303)
    }
    return Response.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 })
  }

  // Parse credentials from either form data or JSON body
  let username = ''
  let password = ''
  try {
    if (isFormPost) {
      const form = await req.formData()
      username = form.get('username')?.toString() ?? ''
      password = form.get('password')?.toString() ?? ''
    } else {
      const body = await req.json()
      username = typeof body.username === 'string' ? body.username : ''
      password = typeof body.password === 'string' ? body.password : ''
    }
  } catch {
    if (isFormPost) {
      return Response.redirect(new URL('/login?error=invalid_request', req.url), 303)
    }
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!username || !password) {
    if (isFormPost) {
      return Response.redirect(new URL('/login?error=missing_credentials', req.url), 303)
    }
    return Response.json({ error: 'Username and password are required' }, { status: 400 })
  }

  const passwordValid = await verifyPassword(password)
  const isValid = isAuthorizedUsername(username) && passwordValid

  if (!isValid) {
    await writeAuditEvent('unknown', {
      event: 'login_failed',
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') ?? 'unknown',
      metadata: { reason: 'invalid_credentials' },
    })
    if (isFormPost) {
      return Response.redirect(new URL('/login?error=invalid_credentials', req.url), 303)
    }
    return Response.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  // Password correct — upsert user into DB then create session
  const user = getAuthorizedUser()

  // Ensure user row exists (FK required by agents, audit_log, etc.)
  const { getDb } = await import('@/lib/db/client')
  const db = getDb()
  db.prepare(`
    INSERT INTO users (id, email, name) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name
  `).run(user.id, user.email, user.name)

  const res = new Response()
  const session = await getIronSession<SessionData>(req, res, getSessionOptions())

  const now = Date.now()
  session.sub = user.id
  session.email = user.email
  session.iat = now
  session.exp = now + 8 * 60 * 60 * 1000
  session.stepUpExpiry = null
  session.csrfToken = generateCsrfToken()
  await session.save()

  await writeAuditEvent(user.id, {
    event: 'login_success',
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? 'unknown',
  })

  // Redirect to dashboard with session cookie
  // Use a plain Response with Location header — Response.redirect() is immutable
  const setCookie = res.headers.get('set-cookie') ?? ''
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL('/dashboard', req.url).toString(),
      ...(setCookie ? { 'set-cookie': setCookie } : {}),
    },
  })
}
