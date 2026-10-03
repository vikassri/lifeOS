import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { SettingsForm } from '@/components/settings/SettingsForm'
import { getDb } from '@/lib/db/client'
import { randomUUID } from 'crypto'

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const userId = session.sub
  if (!userId) return null

  const db = getDb()
  let settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId) as {
    id: string
    user_id: string
    provider: string
    openai_api_key: string | null
    openai_base_url: string
    ollama_base_url: string
    default_model: string
    default_temperature: number
    pages_config: string | null
    google_drive_enabled: number
    google_drive_email: string | null
  } | undefined

  if (!settings) {
    const id = randomUUID()
    db.prepare('INSERT INTO settings (id, user_id) VALUES (?, ?)').run(id, userId)
    settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId) as typeof settings
  }

  if (!settings) return null

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">Configure AI provider, chat preferences, and file storage</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  )
}
