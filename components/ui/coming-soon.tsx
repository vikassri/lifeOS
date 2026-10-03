import type { LucideIcon } from 'lucide-react'

interface ComingSoonProps {
  icon: LucideIcon
  title: string
  description: string
}

export function ComingSoon({ icon: Icon, title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
      <div className="rounded-2xl bg-zinc-800/60 p-5 mb-6">
        <Icon className="h-10 w-10 text-emerald-400" />
      </div>
      <h1 className="text-2xl font-semibold text-zinc-100 mb-2">{title}</h1>
      <p className="text-zinc-400 max-w-sm mb-6">{description}</p>
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 text-sm text-emerald-400">
        Coming soon
      </span>
    </div>
  )
}
