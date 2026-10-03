/**
 * AES-256-GCM vault encryption.
 *
 * Key: ENCRYPTION_KEY env var — 64 hex chars (32 bytes).
 * Storage format: `<iv_hex>:<tag_hex>:<ciphertext_hex>`
 *
 * NEVER import this file from a 'use client' component.
 */
import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64)
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes) in .env.local')
  return Buffer.from(hex, 'hex')
}

/** Encrypt a UTF-8 string → `iv:tag:ciphertext` (all hex). */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv  = randomBytes(12)                               // 96-bit IV for GCM
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/** Decrypt an `iv:tag:ciphertext` string back to UTF-8. */
export function decrypt(payload: string): string {
  const [ivHex, tagHex, ctHex] = payload.split(':')
  if (!ivHex || !tagHex || !ctHex) throw new Error('Invalid encrypted payload format')
  const key = getKey()
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(ctHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}

// ── Vault field types ─────────────────────────────────────────────────────────

export type VaultType = 'website' | 'email' | 'credit_card' | 'bank' | 'other'

export interface WebsiteFields {
  url:      string
  username: string
  password: string
  notes:    string
}

export interface EmailFields {
  email_address:   string
  password:        string
  recovery_email:  string
  notes:           string
}

export interface CreditCardFields {
  cardholder_name: string
  card_number:     string   // e.g. "4111 1111 1111 1111"
  expiry:          string   // "MM/YY"
  cvv:             string
  pin:             string
  notes:           string
}

export interface BankFields {
  bank_name:       string
  account_number:  string
  routing_code:    string   // IFSC / sort code / routing number
  pin:             string
  notes:           string
}

export interface OtherFields {
  fields: { key: string; value: string; hidden: boolean }[]
  notes: string
}

export type VaultFields =
  | WebsiteFields
  | EmailFields
  | CreditCardFields
  | BankFields
  | OtherFields

export interface VaultItem {
  id:             string
  user_id:        string
  type:           VaultType
  name:           string           // plaintext display name
  fields:         VaultFields      // decrypted (never stored as-is)
  created_at:     number
  updated_at:     number
}

/** Decrypts the `encrypted_data` column into a typed `VaultItem`. */
export function decryptVaultItem(row: {
  id: string; user_id: string; type: string; name: string
  encrypted_data: string; created_at: number; updated_at: number
}): VaultItem {
  const fields = JSON.parse(decrypt(row.encrypted_data)) as VaultFields
  return { ...row, type: row.type as VaultType, fields }
}
