interface ColorBadgeProps {
  label: string
  color?: 'emerald' | 'blue' | 'yellow' | 'red' | 'zinc' | 'indigo' | 'orange' | 'purple'
}

const colors: Record<NonNullable<ColorBadgeProps['color']>, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  red: 'bg-red-500/15 text-red-400 border-red-500/20',
  zinc: 'bg-zinc-500/15 text-zinc-400 border-zinc-700',
  indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
}

export function ColorBadge({ label, color = 'zinc' }: ColorBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}
    >
      {label}
    </span>
  )
}
