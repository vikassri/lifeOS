import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { DocumentsClient, type DocumentRow, type DocFileRow } from '@/components/documents/DocumentsClient'

export default async function DocumentsPage() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const userId = session.sub
  if (!userId) return null

  const db = getDb()

  // Text documents (DB)
  const documents = db
    .prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY updated_at DESC')
    .all(userId) as DocumentRow[]

  // Drive files
  const driveFiles = db
    .prepare('SELECT * FROM document_files WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as DocFileRow[]

  // Drive connection status
  const settings = db
    .prepare('SELECT google_drive_enabled, google_drive_email, google_refresh_token FROM settings WHERE user_id = ?')
    .get(userId) as { google_drive_enabled: number; google_drive_email: string | null; google_refresh_token: string | null } | undefined

  const driveConnected = !!(settings?.google_drive_enabled === 1 && settings?.google_refresh_token)

  return (
    <DocumentsClient
      documents={documents}
      driveFiles={driveFiles}
      driveConnected={driveConnected}
      driveEmail={settings?.google_drive_email ?? null}
    />
  )
}
