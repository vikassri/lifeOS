'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  userEmail: string
}

export function Header({ userEmail }: HeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-400">{userEmail}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          aria-label="Sign out"
          className="text-zinc-400 hover:text-zinc-100"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
