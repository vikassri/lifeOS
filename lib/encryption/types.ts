export interface EncryptedData {
  ciphertext: string  // base64 — AES-256-GCM encrypted data
  iv: string          // base64 — 12-byte random IV
  tag: string         // base64 — 16-byte auth tag
}
