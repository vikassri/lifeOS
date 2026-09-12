import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { ShieldCheck, BookOpen, FileText, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const cookieStore = cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Welcome back. Your vault is secure.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Journal Entries', value: '—', icon: BookOpen, color: 'text-blue-400' },
          { label: 'Notes', value: '—', icon: FileText, color: 'text-purple-400' },
          { label: 'Documents', value: '—', icon: FileText, color: 'text-orange-400' },
          { label: 'Net Worth', value: '—', icon: TrendingUp, color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3"
          >
            <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
            <div>
              <p className="text-2xl font-semibold">{value}</p>
              <p className="text-xs text-zinc-500 mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h2 className="text-sm font-medium">Security Status</h2>
        </div>
        <p className="text-xs text-zinc-500 mt-3">
          Authenticated as <span className="text-zinc-300">{session.email}</span>.
          Session expires in 8 hours.
        </p>
      </div>
    </div>
  )
}
