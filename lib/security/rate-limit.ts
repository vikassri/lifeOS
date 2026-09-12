interface RateLimitEntry {
  count: number
  resetAt: number
}

export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
): (key: string) => boolean {
  const store = new Map<string, RateLimitEntry>()

  return function isAllowed(key: string): boolean {
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }

    if (entry.count >= maxRequests) return false

    entry.count++
    return true
  }
}

// Singleton for API routes — 100 requests per minute per IP
export const apiRateLimiter = createRateLimiter(100, 60_000)
// Stricter limiter for auth endpoints — 10 per minute
export const authRateLimiter = createRateLimiter(10, 60_000)
