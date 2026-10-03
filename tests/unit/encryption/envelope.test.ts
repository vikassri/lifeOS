import { describe, it, expect, beforeEach, vi } from 'vitest'

// Provide a real 32-byte test key
const TEST_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes

beforeEach(() => {
  vi.stubEnv('ENCRYPTION_KEY', TEST_KEY)
})

import { encrypt, decrypt, encryptData, decryptData } from '@/lib/encryption/envelope'

describe('Envelope Encryption (local AES-256-GCM)', () => {
  it('roundtrip: encrypt then decrypt returns original plaintext', () => {
    const plaintext = 'super secret journal entry'
    const payload = encrypt(plaintext)
    const result = decrypt(payload)
    expect(result).toBe(plaintext)
  })

  it('encrypted payload has required fields', () => {
    const payload = encrypt('test')
    expect(payload).toHaveProperty('ciphertext')
    expect(payload).toHaveProperty('iv')
    expect(payload).toHaveProperty('tag')
  })

  it('fails decryption with tampered ciphertext', () => {
    const payload = encrypt('secret')
    const tampered = { ...payload, ciphertext: 'dGFtcGVyZWQ=' }
    expect(() => decrypt(tampered)).toThrow()
  })

  it('fails decryption with tampered auth tag', () => {
    const payload = encrypt('secret')
    const tampered = { ...payload, tag: Buffer.from('badbadbadbadbadb').toString('base64') }
    expect(() => decrypt(tampered)).toThrow()
  })

  it('async wrappers (encryptData/decryptData) work correctly', async () => {
    const plaintext = 'async wrapper test'
    const payload = await encryptData(plaintext)
    const result = await decryptData(payload)
    expect(result).toBe(plaintext)
  })

  it('throws when ENCRYPTION_KEY is not set', () => {
    vi.stubEnv('ENCRYPTION_KEY', '')
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY')
    vi.stubEnv('ENCRYPTION_KEY', TEST_KEY)
  })
})
