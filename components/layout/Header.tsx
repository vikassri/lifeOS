'use client'

import { useRouter } from 'next/navigation'
import { LogOut, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  userName: string
}

export function Header({ userName }: HeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
        <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
        <span className="hidden sm:inline">Private workspace</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-semibold text-zinc-300" aria-hidden="true">
          {userName.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-56 truncate text-sm text-zinc-400 sm:inline">{userName}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
          className="gap-2 text-zinc-400 hover:text-zinc-100"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden lg:inline">Sign out</span>
        </Button>
      </div>
    </header>
  )
}
