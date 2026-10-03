/**
 * Centralised definition of all navigable pages.
 * Used by Sidebar (server) and SettingsForm (client).
 */

export interface PageConfig {
  enabled: boolean
  label: string
}

export interface PagesConfig {
  pages: Record<string, PageConfig>
}

export const ALL_PAGES = [
  // Always shown — not configurable
  // { key: 'dashboard', href: '/dashboard', defaultLabel: 'Dashboard', icon: 'LayoutDashboard', alwaysOn: true },
  // { key: 'settings',  href: '/settings',  defaultLabel: 'Settings',  icon: 'Settings',       alwaysOn: true },

  { key: 'chat',        href: '/chat',            defaultLabel: 'Chat',            group: 'AI',       icon: 'MessageSquare',  alwaysOn: false },
  { key: 'agents',      href: '/agents',          defaultLabel: 'Agents',          group: 'AI',       icon: 'Bot',            alwaysOn: false },
  { key: 'journal',     href: '/journal',         defaultLabel: 'Journal',         group: 'Writing',  icon: 'BookOpen',       alwaysOn: false },
  { key: 'notes',       href: '/notes',           defaultLabel: 'Notes',           group: 'Writing',  icon: 'FileText',       alwaysOn: false },
  { key: 'documents',   href: '/documents',       defaultLabel: 'Documents',       group: 'Writing',  icon: 'File',           alwaysOn: false },
  { key: 'projects',    href: '/projects',        defaultLabel: 'Projects',        group: 'Work',     icon: 'FolderOpen',     alwaysOn: false },
  { key: 'links',       href: '/links',           defaultLabel: 'Saved Links',     group: 'Work',     icon: 'Link2',          alwaysOn: false },
  { key: 'investments', href: '/vault/finance',   defaultLabel: 'Investments',     group: 'Finance',  icon: 'TrendingUp',     alwaysOn: false },
  { key: 'net-worth',   href: '/net-worth',       defaultLabel: 'Net Worth',       group: 'Finance',  icon: 'DollarSign',     alwaysOn: false },
  { key: 'passwords',   href: '/vault/passwords', defaultLabel: 'Password Vault',  group: 'Security', icon: 'Lock',           alwaysOn: false },
  { key: 'search',      href: '/search',          defaultLabel: 'Search',          group: 'Other',    icon: 'Search',         alwaysOn: false },
] as const

export type PageKey = typeof ALL_PAGES[number]['key']

/** Merge DB-stored config with defaults (new pages are enabled by default) */
export function resolvePageConfig(raw: string | null | undefined): PagesConfig {
  let stored: Partial<PagesConfig> = {}
  try { stored = JSON.parse(raw ?? '{}') } catch { /* ignore */ }

  const pages: Record<string, PageConfig> = {}
  for (const p of ALL_PAGES) {
    const saved = stored.pages?.[p.key]
    pages[p.key] = {
      enabled: saved?.enabled ?? true,   // default: enabled
      label:   saved?.label   ?? p.defaultLabel,
    }
  }
  return { pages }
}
