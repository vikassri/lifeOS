'use server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

async function getUserId(): Promise<string> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const userId = session.sub
  if (!userId) throw new Error('Unauthorized')
  return userId
}

export async function createLiability(formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO liabilities (id, user_id, name, type, amount, currency, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    formData.get('name')?.toString() ?? '',
    formData.get('type')?.toString() || 'loan',
    parseFloat(formData.get('amount')?.toString() || '0'),
    formData.get('currency')?.toString() || 'SGD',
    formData.get('notes')?.toString() || null,
  )
  revalidatePath('/net-worth')
}

export async function updateLiability(id: string, formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare(`
    UPDATE liabilities SET
      name = ?,
      type = ?,
      amount = ?,
      currency = ?,
      notes = ?,
      updated_at = unixepoch()
    WHERE id = ? AND user_id = ?
  `).run(
    formData.get('name')?.toString() ?? '',
    formData.get('type')?.toString() || 'loan',
    parseFloat(formData.get('amount')?.toString() || '0'),
    formData.get('currency')?.toString() || 'SGD',
    formData.get('notes')?.toString() || null,
    id,
    userId,
  )
  revalidatePath('/net-worth')
}

export async function deleteLiability(id: string) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare('DELETE FROM liabilities WHERE id = ? AND user_id = ?').run(id, userId)
  revalidatePath('/net-worth')
}
