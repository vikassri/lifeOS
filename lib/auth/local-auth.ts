import 'server-only'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'

const AUTHORIZED_USERNAME = 'onlyricks'
const AUTHORIZED_EMAIL = 'onlyricks@lifeos.local'
const HASH_FILE = path.join(process.cwd(), '.data', 'password.hash')

export function getAuthorizedUser() {
  return { id: 'local-user-1', email: AUTHORIZED_EMAIL, name: AUTHORIZED_USERNAME }
}

export function isAuthorizedUsername(username: string): boolean {
  return username === AUTHORIZED_USERNAME
}

function readStoredHash(): string {
  if (!fs.existsSync(HASH_FILE)) {
    throw new Error(
      `Password not set. Run: bash scripts/setup-local.sh`
    )
  }
  return fs.readFileSync(HASH_FILE, 'utf8').trim()
}

export async function verifyPassword(password: string): Promise<boolean> {
  if (!password || password.trim().length === 0) return false
  const stored = readStoredHash()
  return bcrypt.compare(password, stored)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function savePasswordHash(hash: string): Promise<void> {
  const dir = path.dirname(HASH_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(HASH_FILE, hash, { mode: 0o600 })
}
