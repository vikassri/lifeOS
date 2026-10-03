import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface DashboardShellProps {
  children: React.ReactNode
  userName: string
}

export function DashboardShell({ children, userName }: DashboardShellProps) {
  return (
    <div className="flex h-dvh overflow-hidden bg-zinc-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userName={userName} />
        <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6" id="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
