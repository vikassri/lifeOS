import 'server-only'

const AUTHORIZED_EMAIL = 'onlyricks@lifeos.local'

export function isAuthorizedEmail(email: string): boolean {
  return email === AUTHORIZED_EMAIL
}
