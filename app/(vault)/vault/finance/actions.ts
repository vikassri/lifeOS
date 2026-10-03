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

export async function createInvestment(formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO investments (id, user_id, name, type, ticker, quantity, buy_price, currency, country, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    formData.get('name')?.toString() ?? '',
    formData.get('type')?.toString() ?? 'other',
    formData.get('ticker')?.toString() || null,
    parseFloat(formData.get('quantity')?.toString() || '0'),
    parseFloat(formData.get('buy_price')?.toString() || '0'),
    formData.get('currency')?.toString() || 'SGD',
    formData.get('country')?.toString() || 'SG',
    formData.get('notes')?.toString() || null,
  )
  // If a current_value was supplied, auto-save as a snapshot for today
  const currentVal = parseFloat(formData.get('current_value')?.toString() || '')
  if (!isNaN(currentVal) && currentVal > 0) {
    const today = new Date().toISOString().slice(0, 10)
    const period = today.slice(0, 7)          // YYYY-MM
    db.prepare(`
      INSERT INTO investment_snapshots (id, investment_id, user_id, value, period, period_type, snapshot_date)
      VALUES (?, ?, ?, ?, ?, 'monthly', ?)
    `).run(randomUUID(), id, userId, currentVal, period, today)
  }
  revalidatePath('/vault/finance')
}

export async function updateInvestment(id: string, formData: FormData) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare(`
    UPDATE investments SET
      name = ?,
      type = ?,
      ticker = ?,
      quantity = ?,
      buy_price = ?,
      currency = ?,
      country = ?,
      notes = ?,
      updated_at = unixepoch()
    WHERE id = ? AND user_id = ?
  `).run(
    formData.get('name')?.toString() ?? '',
    formData.get('type')?.toString() ?? 'other',
    formData.get('ticker')?.toString() || null,
    parseFloat(formData.get('quantity')?.toString() || '0'),
    parseFloat(formData.get('buy_price')?.toString() || '0'),
    formData.get('currency')?.toString() || 'SGD',
    formData.get('country')?.toString() || 'SG',
    formData.get('notes')?.toString() || null,
    id,
    userId,
  )
  // If a current_value was supplied during edit, add a fresh snapshot for today
  const currentVal = parseFloat(formData.get('current_value')?.toString() || '')
  if (!isNaN(currentVal) && currentVal > 0) {
    const today = new Date().toISOString().slice(0, 10)
    const period = today.slice(0, 7)
    db.prepare(`
      INSERT INTO investment_snapshots (id, investment_id, user_id, value, period, period_type, snapshot_date)
      VALUES (?, ?, ?, ?, ?, 'monthly', ?)
    `).run(randomUUID(), id, userId, currentVal, period, today)
  }
  revalidatePath('/vault/finance')
}

export async function deleteInvestment(id: string) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare('DELETE FROM investments WHERE id = ? AND user_id = ?').run(id, userId)
  revalidatePath('/vault/finance')
}

export async function addSnapshot(
  investmentId: string,
  value: number,
  period: string,
  periodType: string,
  snapshotDate: string,
) {
  const userId = await getUserId()
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO investment_snapshots (id, investment_id, user_id, value, period, period_type, snapshot_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, investmentId, userId, value, period, periodType, snapshotDate)
  revalidatePath('/vault/finance')
}

export async function deleteSnapshot(id: string) {
  const userId = await getUserId()
  const db = getDb()
  db.prepare('DELETE FROM investment_snapshots WHERE id = ? AND user_id = ?').run(id, userId)
  revalidatePath('/vault/finance')
}
