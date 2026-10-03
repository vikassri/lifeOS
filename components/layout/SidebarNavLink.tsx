'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, Bot, BookOpen, FileText,
  FolderOpen, File, Lock, TrendingUp, DollarSign, Search, Settings, Link2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Icon map — lives in the client component so no functions cross the boundary ──
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, MessageSquare, Bot, BookOpen, FileText,
  FolderOpen, File, Lock, TrendingUp, DollarSign, Search, Settings, Link2,
}

interface SidebarNavLinkProps {
  href:     string
  label:    string
  iconName: string   // plain string — safe to pass from Server → Client
}

export function SidebarNavLink({ href, label, iconName }: SidebarNavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  const Icon = ICON_MAP[iconName] ?? File

  return (
    <Link
      href={href}
      title={label}
      className={`flex h-10 items-center justify-center gap-3 rounded-xl px-0 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:h-9 md:justify-start md:px-3 ${
        isActive
          ? 'bg-emerald-500/10 text-emerald-300'
          : 'text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-100'
      }`}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="hidden truncate md:inline">{label}</span>
    </Link>
  )
}
