import { cookies }     from 'next/headers'
import { getIronSession } from 'iron-session'
import Link              from 'next/link'
import {
  ShieldCheck, BookOpen, FileText, TrendingUp, FolderOpen,
  MessageSquare, Lock, DollarSign, Link2, HardDrive, Bot,
  CheckSquare, ArrowRight, Calendar, Tag, Clock,
} from 'lucide-react'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency,
    notation:              'compact',
    maximumFractionDigits: 1,
  }).format(n)
}
function relTime(ts: number) {
  const s = Math.floor(Date.now() / 1000) - ts
  if (s < 60)   return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
function parseMood(m: string | null) {
  const MAP: Record<string, string> = {
    happy: '😊', neutral: '😐', sad: '😢', frustrated: '😤',
    thoughtful: '🤔', energetic: '⚡', grateful: '🙏', anxious: '😰',
  }
  return m ? (MAP[m] ?? '') : ''
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, href }: {
  icon:  React.FC<{ className?: string }>
  label: string; value: string | number; sub?: string
  color: string; href: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between gap-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/30 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className={`rounded-lg p-2 w-fit ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-zinc-100">{value}</p>
        <p className="mt-1 text-xs text-zinc-400">{label}</p>
        {sub && <p className="mt-1 text-[11px] text-zinc-500">{sub}</p>}
      </div>
    </Link>
  )
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight text-zinc-100">{title}</h2>
      <Link href={href} className="flex shrink-0 items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-emerald-400">
        View all <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const cookieStore = await cookies()
  const session     = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const userId      = session.sub
  if (!userId) return null

  const db = getDb()

  // ── Counts ──
  const cnt = <T extends { c: number }>(sql: string, ...p: unknown[]) =>
    (db.prepare(sql).get(...p) as T).c

  const notesCount    = cnt('SELECT COUNT(*) c FROM notes       WHERE user_id=?', userId)
  const journalCount  = cnt('SELECT COUNT(*) c FROM journal_entries WHERE user_id=?', userId)
  const docsCount     = cnt('SELECT COUNT(*) c FROM documents   WHERE user_id=?', userId)
  const driveCount    = cnt('SELECT COUNT(*) c FROM document_files WHERE user_id=?', userId)
  const vaultCount    = cnt('SELECT COUNT(*) c FROM vault_items  WHERE user_id=?', userId)
  const agentsCount   = cnt('SELECT COUNT(*) c FROM agents       WHERE user_id=?', userId)
  const linksCount    = cnt('SELECT COUNT(*) c FROM links        WHERE user_id=?', userId)
  const projectsCount = cnt(`SELECT COUNT(*) c FROM projects WHERE user_id=? AND status='active'`, userId)
  const tasksOpen     = cnt(`SELECT COUNT(*) c FROM project_tasks t JOIN projects p ON t.project_id=p.id WHERE t.user_id=? AND t.done=0 AND p.status='active'`, userId)
  const investCount   = cnt('SELECT COUNT(*) c FROM investments  WHERE user_id=?', userId)

  // ── Net worth per currency ──
  const investments = db.prepare(`
    SELECT i.currency, COALESCE(
      (SELECT s.value FROM investment_snapshots s WHERE s.investment_id=i.id ORDER BY s.created_at DESC LIMIT 1),
      i.quantity * i.buy_price
    ) as val
    FROM investments i WHERE i.user_id=?
  `).all(userId) as { currency: string; val: number }[]

  const liabilities = db.prepare(`
    SELECT currency, SUM(amount) as total FROM liabilities WHERE user_id=? GROUP BY currency
  `).all(userId) as { currency: string; total: number }[]

  const assetsByCur: Record<string, number>   = {}
  const liabByCur:   Record<string, number>   = {}
  for (const r of investments) assetsByCur[r.currency] = (assetsByCur[r.currency] ?? 0) + r.val
  for (const r of liabilities) liabByCur[r.currency]  = (liabByCur[r.currency]  ?? 0) + r.total
  const nwCurrencies = [...new Set([...Object.keys(assetsByCur), ...Object.keys(liabByCur)])]
  const netWorthRows = nwCurrencies.map(c => ({
    currency: c,
    net: (assetsByCur[c] ?? 0) - (liabByCur[c] ?? 0),
  }))

  // ── Recent journal (3) ──
  const recentJournal = db.prepare(`
    SELECT id, title, mood, entry_date FROM journal_entries
    WHERE user_id=? ORDER BY created_at DESC LIMIT 3
  `).all(userId) as { id: string; title: string; mood: string | null; entry_date: string }[]

  // ── Recent notes (3) ──
  const recentNotes = db.prepare(`
    SELECT id, title, tags, updated_at FROM notes
    WHERE user_id=? ORDER BY updated_at DESC LIMIT 3
  `).all(userId) as { id: string; title: string; tags: string; updated_at: number }[]

  // ── Active projects with progress ──
  const activeProjects = db.prepare(`
    SELECT p.id, p.name, p.status, p.due_date,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.done=1 THEN 1 ELSE 0 END) as done_tasks
    FROM projects p
    LEFT JOIN project_tasks t ON t.project_id=p.id
    WHERE p.user_id=? AND p.status='active'
    GROUP BY p.id ORDER BY p.updated_at DESC LIMIT 4
  `).all(userId) as { id: string; name: string; due_date: string | null; total_tasks: number; done_tasks: number }[]

  // ── Drive status ──
  const settings = db.prepare('SELECT google_drive_enabled, google_drive_email, google_refresh_token FROM settings WHERE user_id=?').get(userId) as { google_drive_enabled: number; google_drive_email: string | null; google_refresh_token: string | null } | undefined
  const driveConnected = !!(settings?.google_drive_enabled === 1 && settings?.google_refresh_token)

  // ── Agents ──
  const agentList = db.prepare('SELECT id, name, model FROM agents WHERE user_id=? ORDER BY is_default DESC LIMIT 3').all(userId) as { id: string; name: string; model: string }[]

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = (session.email ?? '').split('@')[0] ?? 'there'

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

      {/* ── Welcome ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-500">Personal overview</p>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-zinc-100 sm:text-4xl">{greeting}, {firstName}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2 text-xs font-medium text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Private space, protected
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={BookOpen}   label="Journal"     value={journalCount} color="text-blue-400 bg-blue-400/10"   href="/journal" />
        <StatCard icon={FileText}   label="Notes"       value={notesCount}   color="text-purple-400 bg-purple-400/10" href="/notes" />
        <StatCard icon={HardDrive}  label="Drive Files" value={driveCount}   sub={`+${docsCount} notes`} color="text-orange-400 bg-orange-400/10" href="/documents" />
        <StatCard icon={Lock}       label="Vault Items" value={vaultCount}   color="text-emerald-400 bg-emerald-400/10" href="/vault/passwords" />
        <StatCard icon={FolderOpen} label="Projects"    value={projectsCount} sub={`${tasksOpen} open tasks`} color="text-yellow-400 bg-yellow-400/10" href="/projects" />
        <StatCard icon={Link2}      label="Links"       value={linksCount}   color="text-cyan-400 bg-cyan-400/10"  href="/links" />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 xl:gap-6">

        {/* Left column (2/3) */}
        <div className="space-y-5 xl:col-span-2 xl:space-y-6">

          {/* Net Worth */}
          {netWorthRows.length > 0 && (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-5 shadow-sm sm:p-6">
              <SectionHeader title="Net Worth" href="/net-worth" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {netWorthRows.map(r => (
                  <div key={r.currency} className="rounded-xl border border-zinc-800/70 bg-zinc-800/60 p-3.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{r.currency}</p>
                    <p className={`text-lg font-bold mt-0.5 ${r.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmt(r.net, r.currency)}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      Assets {fmt(assetsByCur[r.currency] ?? 0, r.currency)} · Liab {fmt(liabByCur[r.currency] ?? 0, r.currency)}
                    </p>
                  </div>
                ))}
                <Link href="/vault/finance" className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-700 bg-zinc-800/30 p-3 text-zinc-500 transition-colors hover:border-emerald-500/40 hover:text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs">{investCount} investments</span>
                </Link>
              </div>
            </div>
          )}

          {/* Active Projects */}
          {activeProjects.length > 0 && (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-5 shadow-sm sm:p-6">
              <SectionHeader title={`Active Projects (${projectsCount})`} href="/projects" />
              <div className="space-y-3">
                {activeProjects.map(p => {
                  const pct = p.total_tasks > 0 ? Math.round((p.done_tasks / p.total_tasks) * 100) : 0
                  return (
                    <div key={p.id} className="space-y-2.5 rounded-xl border border-zinc-800/70 bg-zinc-800/30 px-4 py-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-100 truncate">{p.name}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.due_date && (
                            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                              <Calendar className="h-3 w-3" /> {p.due_date}
                            </span>
                          )}
                          <span className="text-xs text-zinc-500">
                            <CheckSquare className="h-3 w-3 inline mr-0.5" />
                            {p.done_tasks}/{p.total_tasks}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-700/70">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Journal */}
          {recentJournal.length > 0 && (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-5 shadow-sm sm:p-6">
              <SectionHeader title="Recent Journal" href="/journal" />
              <div className="space-y-2">
                {recentJournal.map(e => (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl border border-zinc-800/70 bg-zinc-800/30 px-3.5 py-3">
                    <span className="text-lg shrink-0">{parseMood(e.mood) || '📓'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-200 truncate">{e.title}</p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500">
                        <Calendar className="h-2.5 w-2.5" /> {e.entry_date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-5">

          {/* Quick Actions */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-5 shadow-sm sm:p-6">
            <h2 className="mb-3 text-base font-semibold tracking-tight text-zinc-100">Quick actions</h2>
            <div className="space-y-1.5">
              {[
                { href: '/journal',          icon: BookOpen,      label: 'New journal entry',   color: 'text-blue-400'   },
                { href: '/notes',            icon: FileText,      label: 'New note',            color: 'text-purple-400' },
                { href: '/chat',             icon: MessageSquare, label: 'Chat with AI',        color: 'text-emerald-400'},
                { href: '/vault/passwords',  icon: Lock,          label: 'Add to vault',        color: 'text-yellow-400' },
                { href: '/projects',         icon: FolderOpen,    label: 'View projects',       color: 'text-orange-400' },
                { href: '/vault/finance',    icon: TrendingUp,    label: 'Track investment',    color: 'text-emerald-400'},
                { href: '/documents',        icon: HardDrive,     label: 'Upload to Drive',     color: 'text-cyan-400'   },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                  {label}
                  <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Notes */}
          {recentNotes.length > 0 && (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-5 shadow-sm sm:p-6">
              <SectionHeader title="Recent Notes" href="/notes" />
              <div className="space-y-2">
                {recentNotes.map(n => {
                  let tags: string[] = []
                  try { tags = JSON.parse(n.tags) } catch { /**/ }
                  return (
                    <div key={n.id} className="space-y-1.5 rounded-xl border border-zinc-800/70 bg-zinc-800/30 px-3.5 py-3">
                      <p className="text-sm text-zinc-200 truncate">{n.title}</p>
                      <div className="flex items-center gap-2 justify-between">
                        {tags.length > 0 ? (
                          <div className="flex items-center gap-1 min-w-0">
                            <Tag className="h-2.5 w-2.5 text-zinc-600 shrink-0" />
                            <span className="truncate text-[10px] text-zinc-500">{tags.slice(0,3).join(', ')}</span>
                          </div>
                        ) : <span />}
                        <span className="flex shrink-0 items-center gap-1 text-[10px] text-zinc-500">
                          <Clock className="h-2.5 w-2.5" />{relTime(n.updated_at)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* AI Agents */}
          {agentList.length > 0 && (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-5 shadow-sm sm:p-6">
              <SectionHeader title={`AI Agents (${agentsCount})`} href="/agents" />
              <div className="space-y-2">
                {agentList.map(a => (
                  <Link
                    key={a.id}
                    href="/chat"
                    className="flex items-center gap-2.5 rounded-xl border border-zinc-800/70 bg-zinc-800/30 px-3.5 py-3 transition-colors hover:border-emerald-500/30 hover:bg-zinc-800/60"
                  >
                    <div className="rounded-lg bg-emerald-500/10 p-1.5">
                      <Bot className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{a.name}</p>
                      <p className="text-[10px] text-zinc-600 font-mono">{a.model}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Security / Storage status */}
          <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold tracking-tight text-zinc-100">Your space</h2>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800/70 py-2">
                <span className="text-zinc-500 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />Session</span>
                <span className="text-emerald-400 font-medium">Authenticated</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800/70 py-2">
                <span className="text-zinc-500 flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-yellow-500" />Vault</span>
                <span className="text-zinc-300">{vaultCount} items · AES-256</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-500 flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5 text-cyan-500" />Drive</span>
                {driveConnected
                  ? <span className="text-emerald-400">Connected{settings?.google_drive_email ? ` · ${settings.google_drive_email.split('@')[0]}` : ''}</span>
                  : <Link href="/settings" className="text-zinc-600 hover:text-zinc-400">Not connected →</Link>
                }
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
