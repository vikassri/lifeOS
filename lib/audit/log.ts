import { createHash, randomUUID } from 'crypto'
import { Timestamp } from '@google-cloud/firestore'
import { getFirestoreDb } from '@/lib/db/client'
import { COLLECTIONS } from '@/lib/db/collections'

export type AuditEventType =
  | 'login_success'
  | 'login_failed'
  | 'login_blocked_allowlist'
  | 'logout'
  | 'step_up_completed'
  | 'step_up_failed'
  | 'password_vault_accessed'
  | 'password_revealed'
  | 'password_copied'
  | 'document_uploaded'
  | 'document_downloaded'
  | 'document_deleted'
  | 'financial_data_accessed'
  | 'data_exported'
  | 'security_settings_changed'

export interface AuditEventInput {
  event: AuditEventType
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, string | number | boolean>
}

interface AuditEventDocument {
  id: string
  event: AuditEventType
  sub: string
  ipHash: string        // SHA-256 hash of IP — privacy-preserving
  userAgent: string
  timestamp: Timestamp
  metadata: Record<string, string | number | boolean>
}

export async function writeAuditEvent(
  userId: string,
  input: AuditEventInput,
): Promise<void> {
  const db = getFirestoreDb()
  const eventId = randomUUID()
  const ipHash = input.ipAddress
    ? createHash('sha256').update(input.ipAddress).digest('hex')
    : 'unknown'

  const doc: AuditEventDocument = {
    id: eventId,
    event: input.event,
    sub: userId,
    ipHash,
    userAgent: input.userAgent ?? 'unknown',
    timestamp: Timestamp.now(),
    metadata: input.metadata ?? {},
  }

  await db
    .collection(COLLECTIONS.auditLog(userId))
    .doc(eventId)
    .set(doc)
  // Note: no .update() or .delete() — documents are write-once
}
