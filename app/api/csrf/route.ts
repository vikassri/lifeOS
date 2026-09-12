import { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { generateCsrfToken } from '@/lib/security/csrf'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'

export async function GET(req: NextRequest): Promise<Response> {
  const res = new Response()
  const session = await getIronSession<SessionData>(req, res, getSessionOptions())

  if (!session.csrfToken) {
    session.csrfToken = generateCsrfToken()
    await session.save()
  }

  const headers = new Headers({ 'content-type': 'application/json' })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) headers.set('set-cookie', setCookie)

  return new Response(JSON.stringify({ csrfToken: session.csrfToken }), {
    status: 200,
    headers,
  })
}
