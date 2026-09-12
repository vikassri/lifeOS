import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock KMS before importing envelope
vi.mock('@/lib/encryption/kms', () => ({
  kmsEncryptDek: vi.fn(async (dek: Buffer) => Buffer.from('encrypted-' + dek.toString('base64'))),
  kmsDecryptDek: vi.fn(async (encDek: Buffer) => {
    const str = encDek.toString()
    if (!str.startsWith('encrypted-')) throw new Error('bad key')
    return Buffer.from(str.replace('encrypted-', ''), 'base64')
  }),
}))

import { encryptData, decryptData } from '@/lib/encryption/envelope'

describe('Envelope Encryption', () => {
  const aad = 'user-123:doc-456'

  it('roundtrip: encrypt then decrypt returns original plaintext', async () => {
    const plaintext = 'super secret journal entry'
    const payload = await encryptData(plaintext, aad)
    const result = await decryptData(payload, aad)
    expect(result).toBe(plaintext)
  })

  it('encrypted payload has required fields', async () => {
    const payload = await encryptData('test', aad)
    expect(payload).toHaveProperty('ciphertext')
    expect(payload).toHaveProperty('encryptedDek')
    expect(payload).toHaveProperty('iv')
    expect(payload).toHaveProperty('keyVersion')
  })

  it('fails decryption with wrong associated data (AAD)', async () => {
    const payload = await encryptData('secret', aad)
    await expect(decryptData(payload, 'wrong-aad')).rejects.toThrow()
  })

  it('fails decryption with tampered ciphertext', async () => {
    const payload = await encryptData('secret', aad)
    const tampered = { ...payload, ciphertext: 'dGFtcGVyZWQ=' }
    await expect(decryptData(tampered, aad)).rejects.toThrow()
  })
})
