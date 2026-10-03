'use server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { encrypt, type VaultType, type VaultFields } from '@/lib/crypto/vault'

async function getUserId(): Promise<string> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  if (!session.sub) throw new Error('Unauthenticated')
  return session.sub
}

// ── Create ────────────────────────────────────────────────────────────────────
export async function createVaultItem(
  type: VaultType,
  name: string,
  fields: VaultFields,
): Promise<void> {
  const userId = await getUserId()
  const db = getDb()
  db.prepare(`
    INSERT INTO vault_items (id, user_id, type, name, encrypted_data)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, type, name.trim(), encrypt(JSON.stringify(fields)))
  revalidatePath('/vault/passwords')
}

// ── Update ────────────────────────────────────────────────────────────────────
export async function updateVaultItem(
  id: string,
  name: string,
  fields: VaultFields,
): Promise<void> {
  const userId = await getUserId()
  const db = getDb()
  db.prepare(`
    UPDATE vault_items
    SET name = ?, encrypted_data = ?, updated_at = unixepoch()
    WHERE id = ? AND user_id = ?
  `).run(name.trim(), encrypt(JSON.stringify(fields)), id, userId)
  revalidatePath('/vault/passwords')
}

// ── Delete ────────────────────────────────────────────────────────────────────
export async function deleteVaultItem(id: string): Promise<void> {
  const userId = await getUserId()
  const db = getDb()
  db.prepare('DELETE FROM vault_items WHERE id = ? AND user_id = ?').run(id, userId)
  revalidatePath('/vault/passwords')
}
