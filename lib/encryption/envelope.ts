import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { kmsEncryptDek, kmsDecryptDek } from './kms'
import type { EncryptedPayload } from './types'

const ALGORITHM = 'aes-256-gcm'
const AUTH_TAG_LENGTH = 16

export async function encryptData(
  plaintext: string,
  associatedData: string,
): Promise<EncryptedPayload> {
  // 1. Generate random DEK (Data Encryption Key) — 32 bytes
  const dek = randomBytes(32)
  // 2. Generate random IV — 12 bytes for GCM
  const iv = randomBytes(12)
  // 3. Encrypt plaintext with DEK using AES-256-GCM
  const cipher = createCipheriv(ALGORITHM, dek, iv, { authTagLength: AUTH_TAG_LENGTH })
  cipher.setAAD(Buffer.from(associatedData, 'utf8'))
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // 4. Combine encrypted data + auth tag
  const ciphertextWithTag = Buffer.concat([encrypted, authTag])
  // 5. Encrypt DEK with KMS
  const encryptedDek = await kmsEncryptDek(dek)
  // 6. Zero out DEK from memory (best-effort)
  dek.fill(0)

  return {
    ciphertext: ciphertextWithTag.toString('base64'),
    encryptedDek: encryptedDek.toString('base64'),
    iv: iv.toString('base64'),
    keyVersion: '1',
    encryptedAt: Date.now(),
  }
}

export async function decryptData(
  payload: EncryptedPayload,
  associatedData: string,
): Promise<string> {
  // 1. Decrypt DEK with KMS
  const encryptedDekBuffer = Buffer.from(payload.encryptedDek, 'base64')
  const dek = await kmsDecryptDek(encryptedDekBuffer)
  // 2. Split ciphertext + auth tag
  const ciphertextWithTag = Buffer.from(payload.ciphertext, 'base64')
  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - AUTH_TAG_LENGTH)
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - AUTH_TAG_LENGTH)
  const iv = Buffer.from(payload.iv, 'base64')
  // 3. Decrypt
  const decipher = createDecipheriv(ALGORITHM, dek, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAAD(Buffer.from(associatedData, 'utf8'))
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  // 4. Zero out DEK from memory (best-effort)
  dek.fill(0)

  return decrypted.toString('utf8')
}
