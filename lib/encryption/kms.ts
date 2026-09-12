import { KeyManagementServiceClient } from '@google-cloud/kms'

const KMS_KEY_NAME = process.env['KMS_KEY_NAME'] ?? ''
// Format: projects/{project}/locations/{location}/keyRings/{keyRing}/cryptoKeys/{key}

let _client: KeyManagementServiceClient | null = null

function getKmsClient(): KeyManagementServiceClient {
  if (!_client) {
    _client = new KeyManagementServiceClient()
  }
  return _client
}

export async function kmsEncryptDek(dek: Buffer): Promise<Buffer> {
  if (!KMS_KEY_NAME) throw new Error('KMS_KEY_NAME is not configured')
  const client = getKmsClient()
  const [result] = await client.encrypt({
    name: KMS_KEY_NAME,
    plaintext: dek,
  })
  if (!result.ciphertext) throw new Error('KMS encrypt returned empty ciphertext')
  return Buffer.from(result.ciphertext)
}

export async function kmsDecryptDek(encryptedDek: Buffer): Promise<Buffer> {
  if (!KMS_KEY_NAME) throw new Error('KMS_KEY_NAME is not configured')
  const client = getKmsClient()
  const [result] = await client.decrypt({
    name: KMS_KEY_NAME,
    ciphertext: encryptedDek,
  })
  if (!result.plaintext) throw new Error('KMS decrypt returned empty plaintext')
  return Buffer.from(result.plaintext)
}
