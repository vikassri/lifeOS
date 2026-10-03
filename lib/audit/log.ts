import 'server-only'
import { createHash, randomUUID } from 'crypto'
import { getDb } from '@/lib/db/client'

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

export async function writeAuditEvent(
  userId: string,
  input: AuditEventInput,
): Promise<void> {
  try {
    const db = getDb()
    const ipHash = input.ipAddress
      ? createHash('sha256').update(input.ipAddress).digest('hex')
      : 'unknown'

    db.prepare(`
      INSERT INTO audit_log (id, user_id, event, ip_hash, user_agent, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      userId,
      input.event,
      ipHash,
      input.userAgent ?? 'unknown',
      input.metadata ? JSON.stringify(input.metadata) : null,
    )
  } catch (err) {
    console.error('[audit] failed to write event', { event: input.event, err })
  }
}
