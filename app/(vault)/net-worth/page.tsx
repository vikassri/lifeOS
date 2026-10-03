import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { NetWorthClient, type LiabilityRow, type NetWorthInvestment } from '@/components/net-worth/NetWorthClient'

interface InvRow {
  id: string
  name: string
  type: string
  currency: string
  country: string
  quantity: number
  buy_price: number
}

interface SnapRow {
  investment_id: string
  value: number
  snapshot_date: string
}

export default async function NetWorthPage() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const userId = session.sub
  if (!userId) return null

  const db = getDb()

  const invRows = db
    .prepare('SELECT id, name, type, currency, country, quantity, buy_price FROM investments WHERE user_id = ?')
    .all(userId) as InvRow[]

  // Latest snapshot per investment
  const latestSnaps = db
    .prepare(`
      SELECT s.investment_id, s.value, s.snapshot_date
      FROM investment_snapshots s
      INNER JOIN (
        SELECT investment_id, MAX(snapshot_date) as max_date
        FROM investment_snapshots
        WHERE user_id = ?
        GROUP BY investment_id
      ) latest ON s.investment_id = latest.investment_id AND s.snapshot_date = latest.max_date
      WHERE s.user_id = ?
    `)
    .all(userId, userId) as SnapRow[]

  const investments: NetWorthInvestment[] = invRows.map((inv) => {
    const snap = latestSnaps.find((s) => s.investment_id === inv.id)
    // Fallback to cost basis when no snapshot exists
    const currentValue = snap?.value ?? (inv.quantity * inv.buy_price)
    const hasSnapshot = !!snap
    return {
      id: inv.id,
      name: inv.name,
      type: inv.type,
      currency: inv.currency,
      country: inv.country,
      currentValue,
      hasSnapshot,
    }
  })

  const liabilities = db
    .prepare('SELECT * FROM liabilities WHERE user_id = ? ORDER BY amount DESC')
    .all(userId) as LiabilityRow[]

  return <NetWorthClient investments={investments} liabilities={liabilities} />
}
