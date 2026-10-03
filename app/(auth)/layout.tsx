export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-background relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10">
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </div>
  )
}
