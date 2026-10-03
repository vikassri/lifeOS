import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { LinksClient } from '@/components/links/LinksClient'

export interface LinkRow {
  id: string
  title: string
  url: string
  description: string | null
  tags: string   // JSON array string
  created_at: number
  updated_at: number
}

export default async function LinksPage() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const userId = session.sub

  const db = getDb()
  const links = db
    .prepare('SELECT * FROM links WHERE user_id=? ORDER BY created_at DESC')
    .all(userId) as LinkRow[]

  // Collect all unique tags across all links
  const allTags = Array.from(
    new Set(
      links.flatMap(l => {
        try { return JSON.parse(l.tags) as string[] }
        catch { return [] }
      })
    )
  ).sort()

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Saved Links</h1>
        <p className="text-zinc-400 text-sm mt-1">Bookmark URLs with tags for easy retrieval</p>
      </div>
      <LinksClient links={links} allTags={allTags} />
    </div>
  )
}
