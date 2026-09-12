import { randomBytes, timingSafeEqual } from 'crypto'

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

export function validateCsrfToken(
  sessionToken: string,
  headerToken: string,
): boolean {
  if (!sessionToken || !headerToken) return false
  if (sessionToken.length !== headerToken.length) return false
  try {
    return timingSafeEqual(
      Buffer.from(sessionToken, 'utf8'),
      Buffer.from(headerToken, 'utf8'),
    )
  } catch {
    return false
  }
}
