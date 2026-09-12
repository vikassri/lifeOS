import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface DashboardShellProps {
  children: React.ReactNode
  userEmail: string
}

export function DashboardShell({ children, userEmail }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={userEmail} />
        <main className="flex-1 overflow-auto p-6" role="main">
          {children}
        </main>
      </div>
    </div>
  )
}
