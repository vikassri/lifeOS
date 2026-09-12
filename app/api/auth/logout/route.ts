import { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { getSessionOptions, isSessionValid, type SessionData } from '@/lib/auth/session'
import { writeAuditEvent } from '@/lib/audit/log'

export async function POST(req: NextRequest): Promise<Response> {
  const res = new Response()
  const session = await getIronSession<SessionData>(req, res, getSessionOptions())

  if (isSessionValid(session)) {
    await writeAuditEvent(session.sub, {
      event: 'logout',
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    })
  }

  session.destroy()

  const redirectResponse = Response.redirect(new URL('/login', req.url), 302)
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) redirectResponse.headers.set('set-cookie', setCookie)
  return redirectResponse
}
