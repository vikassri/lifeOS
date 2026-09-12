import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { exchangeCodeForUserInfo } from '@/lib/auth/google-oauth'
import { isAuthorizedEmail } from '@/lib/auth/allowlist'
import { validateCsrfToken, generateCsrfToken } from '@/lib/security/csrf'
import { createErrorResponse } from '@/lib/errors/api-error'
import { writeAuditEvent } from '@/lib/audit/log'

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const returnedState = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle OAuth errors (user denied access, etc.)
  if (error) {
    return Response.redirect(new URL('/login?error=access_denied', req.url), 302)
  }

  if (!code || !returnedState) {
    return createErrorResponse(400, 'Invalid callback parameters')
  }

  const res = new Response()
  const session = await getIronSession<SessionData>(req, res, getSessionOptions())

  // Validate CSRF state parameter
  const storedState = session.oauthState
  const codeVerifier = session.oauthCodeVerifier
  const stateExpiry = session.oauthStateExpiry

  // Clear PKCE state immediately (one-time use)
  delete session.oauthState
  delete session.oauthCodeVerifier
  delete session.oauthStateExpiry

  if (!storedState || !codeVerifier || !stateExpiry) {
    return createErrorResponse(403, 'Invalid OAuth session')
  }

  if (Date.now() > stateExpiry) {
    return createErrorResponse(403, 'OAuth state expired')
  }

  // Timing-safe state comparison — MUST use validateCsrfToken (not ===)
  if (!validateCsrfToken(storedState, returnedState)) {
    return createErrorResponse(403, 'State mismatch — possible CSRF attack')
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ua = req.headers.get('user-agent') ?? 'unknown'

  let userInfo
  try {
    userInfo = await exchangeCodeForUserInfo(code, codeVerifier)
  } catch {
    return createErrorResponse(500, 'Authentication failed')
  }

  // Server-side allowlist check — NEVER skip this
  if (!userInfo.email_verified) {
    await writeAuditEvent('unknown', {
      event: 'login_failed',
      ipAddress: ip,
      userAgent: ua,
      metadata: { reason: 'email_not_verified' },
    })
    return createErrorResponse(403, 'Email not verified')
  }

  if (!isAuthorizedEmail(userInfo.email)) {
    await writeAuditEvent(userInfo.sub, {
      event: 'login_blocked_allowlist',
      ipAddress: ip,
      userAgent: ua,
    })
    return Response.redirect(new URL('/login?error=unauthorized', req.url), 302)
  }

  // Create authenticated session
  const now = Date.now()
  session.sub = userInfo.sub
  session.email = userInfo.email
  session.iat = now
  session.exp = now + 8 * 60 * 60 * 1000 // 8 hours
  session.stepUpExpiry = null
  session.csrfToken = generateCsrfToken()
  await session.save()

  await writeAuditEvent(userInfo.sub, {
    event: 'login_success',
    ipAddress: ip,
    userAgent: ua,
  })

  const dashboardUrl = new URL('/dashboard', req.url)
  const redirectResponse = Response.redirect(dashboardUrl, 302)
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) redirectResponse.headers.set('set-cookie', setCookie)
  return redirectResponse
}
