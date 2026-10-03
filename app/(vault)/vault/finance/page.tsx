import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { InvestmentsClient, type InvestmentRow, type InvestmentSnapshot } from '@/components/investments/InvestmentsClient'

export default async function FinancePage() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const userId = session.sub
  if (!userId) return null

  const db = getDb()

  const invRows = db
    .prepare('SELECT * FROM investments WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as Omit<InvestmentRow, 'snapshots'>[]

  const snapshots = db
    .prepare('SELECT * FROM investment_snapshots WHERE user_id = ? ORDER BY snapshot_date DESC')
    .all(userId) as InvestmentSnapshot[]

  const investments: InvestmentRow[] = invRows.map((inv) => ({
    ...inv,
    snapshots: snapshots.filter((s) => s.investment_id === inv.id),
  }))

  return <InvestmentsClient investments={investments} />
}
