'use client'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'

const OPTIONS = [
  { value: 'light',  Icon: Sun,     label: 'Light mode'  },
  { value: 'dark',   Icon: Moon,    label: 'Dark mode'   },
  { value: 'system', Icon: Monitor, label: 'System theme' },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — only render after client mount
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-8 w-[88px]" aria-hidden /> // placeholder preserving layout

  return (
    <div
      role="group"
      aria-label="Theme switcher"
      className="flex items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-800 p-0.5 max-md:w-12 max-md:justify-center max-md:gap-0 max-md:border-0 max-md:bg-transparent max-md:p-0"
    >
      {OPTIONS.map(({ value, Icon, label }) => {
        const isActive = theme === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            className={`flex items-center justify-center rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 max-md:p-0.5 ${
              isActive
                ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50'
            }`}
          >
            <Icon className="h-3.5 w-3.5 max-md:h-3 max-md:w-3" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
