import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { redirect } from 'next/navigation'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { decryptVaultItem, type VaultItem } from '@/lib/crypto/vault'
import { VaultClient } from '@/components/vault/VaultClient'
import { createVaultItem, updateVaultItem, deleteVaultItem } from './actions'

export default async function PasswordVaultPage() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  if (!session.sub) redirect('/login')

  const db = getDb()
  const rows = db
    .prepare(`
      SELECT id, user_id, type, name, encrypted_data, created_at, updated_at
      FROM vault_items
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `)
    .all(session.sub) as {
      id: string; user_id: string; type: string; name: string
      encrypted_data: string; created_at: number; updated_at: number
    }[]

  // Decrypt server-side — client component only receives plain objects
  const items: VaultItem[] = rows.map(decryptVaultItem)

  return (
    <VaultClient
      items={items}
      onCreate={createVaultItem}
      onUpdate={updateVaultItem}
      onDelete={deleteVaultItem}
    />
  )
}
