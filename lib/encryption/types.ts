export interface EncryptedPayload {
  ciphertext: string   // base64 — AES-256-GCM encrypted data
  encryptedDek: string // base64 — KMS-encrypted Data Encryption Key
  iv: string           // base64 — 12-byte random IV
  keyVersion: string   // KMS key version used (for rotation support)
  encryptedAt: number  // Unix timestamp
}
