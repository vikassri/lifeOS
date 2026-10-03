import { ShieldCheck } from 'lucide-react'

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams

  const errorMessage =
    error === 'invalid_credentials' ? 'Invalid username or password. Try again.' :
    error === 'missing_credentials' ? 'Enter your username and password.' :
    error === 'too_many_attempts' ? 'Too many attempts. Wait a minute.' :
    error ? 'Something went wrong. Try again.' :
    null

  return (
    <div className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-800/80 bg-zinc-900/80 px-6 py-8 shadow-2xl shadow-black/20 backdrop-blur sm:px-9 sm:py-10">
      <div className="space-y-3 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
            <ShieldCheck className="h-7 w-7 text-emerald-400" />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-500">A space of your own</p>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-zinc-100">Welcome to lifeOS</h1>
          <p className="text-sm text-zinc-400">Your private life, thoughtfully organized.</p>
        </div>
      </div>

      {/* Plain HTML form — works without JavaScript */}
      <form action="/api/auth/login" method="POST" className="space-y-5">
        <div>
          <label htmlFor="username" className="mb-2 block text-sm font-medium text-zinc-300">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="Enter your username"
            required
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/70 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/70 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-red-800/70 bg-red-950/40 px-4 py-3 text-sm text-red-300"
          >
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
        >
          Sign in
        </button>
      </form>

      <p className="text-center text-xs leading-relaxed text-zinc-500">
        Private access only <span className="mx-1.5 text-zinc-700">·</span> All data stays on your machine
      </p>
    </div>
  )
}
