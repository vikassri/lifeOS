import Link from 'next/link'
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  BookOpen,
  FileText,
  FolderOpen,
  File,
  Lock,
  TrendingUp,
  DollarSign,
  Search,
  Settings,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/documents', label: 'Documents', icon: File },
  { href: '/vault/passwords', label: 'Password Vault', icon: Lock },
  { href: '/vault/finance', label: 'Investments', icon: TrendingUp },
  { href: '/net-worth', label: 'Net Worth', icon: DollarSign },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 flex-col border-r border-zinc-800 bg-zinc-900 px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="h-6 w-6 rounded bg-emerald-500/20 flex items-center justify-center">
          <span className="text-xs font-bold text-emerald-400">L</span>
        </div>
        <span className="text-sm font-semibold">Life OS</span>
      </div>
      <nav className="flex-1 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            aria-label={label}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
