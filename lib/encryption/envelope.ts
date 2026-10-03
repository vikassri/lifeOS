import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import type { EncryptedData } from './types'

function getEncryptionKey(): Buffer {
  const key = process.env['ENCRYPTION_KEY']
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is required')
  const buf = Buffer.from(key, 'hex')
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return buf
}

export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

export function decrypt(data: EncryptedData): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(data.iv, 'base64')
  const tag = Buffer.from(data.tag, 'base64')
  const ciphertext = Buffer.from(data.ciphertext, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

// Legacy-compatible wrappers (async API preserved for call sites)
export async function encryptData(plaintext: string): Promise<EncryptedData> {
  return encrypt(plaintext)
}

export async function decryptData(data: EncryptedData): Promise<string> {
  return decrypt(data)
}
