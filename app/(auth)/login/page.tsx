import { LoginButton } from '@/components/auth/LoginButton'
import { ShieldCheck } from 'lucide-react'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const errorMessage =
    searchParams.error === 'unauthorized'
      ? 'Access denied. This vault is private.'
      : searchParams.error === 'access_denied'
        ? 'Sign-in was cancelled.'
        : null

  return (
    <div className="w-full max-w-sm space-y-8 px-4">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="rounded-full bg-zinc-800 p-4">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Life OS</h1>
        <p className="text-sm text-zinc-400">Your private digital vault</p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300"
        >
          {errorMessage}
        </div>
      )}

      <LoginButton />

      <p className="text-center text-xs text-zinc-600">
        Private access only. Unauthorized access is logged.
      </p>
    </div>
  )
}
