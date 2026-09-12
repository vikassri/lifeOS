import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { generatePkce, generateState, buildAuthorizationUrl } from '@/lib/auth/google-oauth'
import { authRateLimiter } from '@/lib/security/rate-limit'
import { createErrorResponse } from '@/lib/errors/api-error'

export async function GET(req: NextRequest): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (!authRateLimiter(ip)) {
    return createErrorResponse(429, 'Too many requests')
  }

  const { codeVerifier, codeChallenge } = generatePkce()
  const state = generateState()
  const stateExpiry = Date.now() + 5 * 60 * 1000 // 5 minute PKCE window

  const res = new Response()
  const session = await getIronSession<SessionData>(req, res, getSessionOptions())
  session.oauthState = state
  session.oauthCodeVerifier = codeVerifier
  session.oauthStateExpiry = stateExpiry
  await session.save()

  const authUrl = buildAuthorizationUrl(state, codeChallenge)

  // Validate redirect URL is to Google (prevent open redirect)
  const parsedUrl = new URL(authUrl)
  if (parsedUrl.hostname !== 'accounts.google.com') {
    return createErrorResponse(500, 'Invalid redirect target')
  }

  const redirectResponse = Response.redirect(authUrl, 302)
  // Copy session cookie to redirect response
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) redirectResponse.headers.set('set-cookie', setCookie)
  return redirectResponse
}
