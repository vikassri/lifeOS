import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import Link from 'next/link'
import { ALL_PAGES, resolvePageConfig } from '@/lib/pages-config'
import { SidebarNavLink } from './SidebarNavLink'
import { ThemeToggle } from './ThemeToggle'

const GROUPS = ['AI', 'Writing', 'Work', 'Finance', 'Security', 'Other'] as const
type Group = typeof GROUPS[number]

export async function Sidebar() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())

  let pagesConfig = resolvePageConfig(null) // all-enabled defaults

  if (session.sub) {
    try {
      const db = getDb()
      const row = db
        .prepare('SELECT pages_config FROM settings WHERE user_id = ?')
        .get(session.sub) as { pages_config: string | null } | undefined
      pagesConfig = resolvePageConfig(row?.pages_config)
    } catch { /* DB might not have column yet — use defaults */ }
  }

  const enabledPages = ALL_PAGES.filter(p => pagesConfig.pages[p.key]?.enabled !== false)

  const byGroup = Object.fromEntries(GROUPS.map(g => [g, [] as typeof enabledPages])) as Record<Group, typeof enabledPages>
  for (const page of enabledPages) {
    byGroup[page.group as Group].push(page)
  }

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col overflow-y-auto border-r border-zinc-800/80 bg-zinc-950/95 px-2 py-5 md:w-60 md:px-3">
      {/* Logo */}
      <Link
        href="/dashboard"
        aria-label="lifeOS dashboard"
        className="mb-7 flex items-center justify-center gap-2 rounded-xl px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:justify-start md:px-2"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
          <span className="text-sm font-semibold text-emerald-400">l</span>
        </div>
        <span className="hidden text-sm font-semibold tracking-tight text-zinc-100 md:inline">lifeOS</span>
      </Link>

      <nav className="flex-1 space-y-5" aria-label="Main navigation">
        {/* Dashboard — always visible — pass iconName as plain string */}
        <SidebarNavLink href="/dashboard" label="Dashboard" iconName="LayoutDashboard" />

        {GROUPS.map(group => {
          const pages = byGroup[group]
          if (pages.length === 0) return null
          return (
            <div key={group} className="space-y-1">
              <p className="hidden px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 md:block">
                {group}
              </p>
              {pages.map(page => (
                <SidebarNavLink
                  key={page.key}
                  href={page.href}
                  label={pagesConfig.pages[page.key]?.label ?? page.defaultLabel}
                  iconName={page.icon}   // ← plain string, not a component reference
                />
              ))}
            </div>
          )
        })}
      </nav>

      {/* Settings + Theme toggle — always at bottom */}
      <div className="mt-3 space-y-2 border-t border-zinc-800/80 pt-3">
        <SidebarNavLink href="/settings" label="Settings" iconName="Settings" />
        <div className="flex items-center justify-center px-0 md:justify-between md:px-2">
          <span className="hidden text-[10px] font-medium uppercase tracking-wider text-zinc-500 md:inline">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
