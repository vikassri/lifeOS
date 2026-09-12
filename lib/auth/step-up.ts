import type { SessionData } from './session'

const STEP_UP_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export function requiresStepUp(session: SessionData): boolean {
  if (session.stepUpExpiry === null) return true
  return Date.now() > session.stepUpExpiry
}

export function grantStepUp(session: SessionData): SessionData {
  return {
    ...session,
    stepUpExpiry: Date.now() + STEP_UP_WINDOW_MS,
  }
}

// Routes that require step-up authentication
export const STEP_UP_ROUTES = new Set([
  '/vault/passwords',
  '/vault/finance',
  '/api/v1/passwords',
  '/api/v1/export',
  '/api/v1/delete-permanent',
  '/api/v1/security-settings',
])

export function routeRequiresStepUp(pathname: string): boolean {
  for (const route of STEP_UP_ROUTES) {
    if (pathname.startsWith(route)) return true
  }
  return false
}
