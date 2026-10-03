import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'

/**
 * GET /api/v1/ai/ollama-models?base_url=http://localhost:11434
 *
 * Server-side proxy to avoid CORS issues when the browser fetches
 * directly from the Ollama daemon. The Next.js server calls Ollama
 * from the same machine — no CORS restrictions apply.
 */
export async function GET(req: NextRequest) {
  // Auth guard
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  if (!session.sub) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const rawUrl = req.nextUrl.searchParams.get('base_url') ?? 'http://localhost:11434'

  // Basic sanitisation — only allow http/https URLs
  let baseUrl: URL
  try {
    baseUrl = new URL(rawUrl)
    if (!['http:', 'https:'].includes(baseUrl.protocol)) throw new Error('Invalid protocol')
  } catch {
    return NextResponse.json({ error: 'Invalid base_url parameter' }, { status: 400 })
  }

  const tagsUrl = `${baseUrl.origin}/api/tags`

  try {
    const res = await fetch(tagsUrl, {
      signal: AbortSignal.timeout(6_000),
      headers: { Accept: 'application/json' },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Ollama returned HTTP ${res.status}` },
        { status: 502 },
      )
    }

    const data = await res.json() as { models?: { name: string; size?: number; modified_at?: string }[] }
    const models: string[] = (data.models ?? []).map(m => m.name).filter(Boolean)

    if (models.length === 0) {
      return NextResponse.json(
        { error: 'No models found. Pull one first: ollama pull llama3' },
        { status: 200 },
      )
    }

    return NextResponse.json({ models })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = msg.includes('timeout') || msg.includes('abort')
    return NextResponse.json(
      { error: isTimeout ? 'Connection timed out — is Ollama running?' : `Cannot reach Ollama: ${msg}` },
      { status: 502 },
    )
  }
}
