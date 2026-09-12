import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { apiRateLimiter } from '@/lib/security/rate-limit'
import { validateCsrfToken } from '@/lib/security/csrf'
import { getSessionOptions, isSessionValid, type SessionData } from '@/lib/auth/session'
import { isAuthorizedEmail } from '@/lib/auth/allowlist'
import { requiresStepUp } from '@/lib/auth/step-up'
import { createErrorResponse } from '@/lib/errors/api-error'
import { writeAuditEvent } from '@/lib/audit/log'

type RouteHandler = (
  req: NextRequest,
  context: { session: SessionData; params?: Record<string, string> },
) => Promise<Response>

interface ApiGuardOptions {
  requireStepUp?: boolean
  skipCsrf?: boolean   // Only true for GET requests (no state change)
}

export function withApiGuard(
  handler: RouteHandler,
  options: ApiGuardOptions = {},
): (req: NextRequest) => Promise<Response> {
  return async function guardedHandler(req: NextRequest): Promise<Response> {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // Step 1: Rate limiting
    if (!apiRateLimiter(ip)) {
      return createErrorResponse(429, 'Too many requests')
    }

    // Step 2: CSRF check (skip for read-only GET requests when explicitly opted out)
    if (!options.skipCsrf && req.method !== 'GET') {
      const csrfHeader = req.headers.get('x-csrf-token')
      const csrfSession = await getIronSession<SessionData>(
        req,
        new Response(),
        getSessionOptions(),
      )
      if (
        !csrfHeader ||
        !csrfSession.csrfToken ||
        !validateCsrfToken(csrfSession.csrfToken, csrfHeader)
      ) {
        return createErrorResponse(403, 'Invalid CSRF token')
      }
    }

    // Step 3: Session validation
    const resForSession = new Response()
    const session = await getIronSession<SessionData>(req, resForSession, getSessionOptions())
    if (!isSessionValid(session)) {
      return createErrorResponse(401, 'Authentication required')
    }

    // Step 4: Allowlist check (defense-in-depth — belt & suspenders)
    if (!isAuthorizedEmail(session.email)) {
      await writeAuditEvent(session.sub, {
        event: 'login_blocked_allowlist',
        ipAddress: ip,
        userAgent: req.headers.get('user-agent') ?? undefined,
      })
      return createErrorResponse(403, 'Access denied')
    }

    // Step 5: Step-up authentication check
    if (options.requireStepUp && requiresStepUp(session)) {
      return createErrorResponse(403, 'Step-up authentication required')
    }

    // Step 6: Schema validation happens inside the handler (Zod)
    // Step 7: Business logic
    const response = await handler(req, { session })

    // Step 8: Audit logging happens inside the handler for specific events
    return response
  }
}
