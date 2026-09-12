// SERVER-ONLY — never import this in client components
// This file must never appear in browser bundles

const AUTHORIZED_EMAILS: ReadonlySet<string> = new Set([
  'er.vikassri@gmail.com',
])

export function isAuthorizedEmail(email: string): boolean {
  return AUTHORIZED_EMAILS.has(email)
}
