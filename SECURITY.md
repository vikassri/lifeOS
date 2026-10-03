# Security Model

Life OS follows a **zero-trust** security model. Every request is authenticated, authorized, and validated before reaching business logic. No sensitive data is exposed to the browser.

## Core Principles

### Browser Isolation

The browser **never** receives:

- Firestore SDK or credentials
- Password hashes
- Encryption keys or DEKs
- Raw database query results

Only shaped API responses and an encrypted HTTP-only session cookie are sent to the client.

### Authentication

| Control | Implementation |
|---------|---------------|
| Login | Username `onlyricks` plus password verified against a bcrypt hash |
| Session storage | iron-session (AES-256-CBC encrypted cookie) |
| Cookie flags | HttpOnly, Secure (production), SameSite=Lax |
| Session lifetime | 8 hours with sliding window refresh |
| Authorization | Server-side single-account allowlist checked on pages and API requests |
| Brute-force protection | Per-IP rate limiting for login attempts |
| Step-up auth | 15-minute elevated window for sensitive operations |

### Encryption

| Layer | Method |
|-------|--------|
| Data at rest (sensitive fields) | AES-256-GCM envelope encryption via Cloud KMS |
| Data at rest (documents) | GCS CMEK (KMS-managed) |
| Data at rest (metadata) | Firestore default (Google-managed AES-256) |
| Data in transit | TLS 1.3 only |
| Session cookie | iron-session AES-256-CBC |

### API Protection

Every `/api/v1/*` request passes through:

1. **Rate limiting** — per-IP request throttling
2. **CSRF validation** — double-submit cookie pattern
3. **Session validation** — verify cookie integrity and expiry
4. **Allowlist check** — reject sessions outside the authorized local account
5. **Step-up check** — enforce elevated auth on sensitive routes
6. **Input validation** — Zod schema rejection of malformed input

### HTTP Security Headers

Set via `next.config.ts` and Edge Middleware:

- Content-Security-Policy (strict, nonce-based scripts)
- Strict-Transport-Security (HSTS preload)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Cross-Origin-Opener-Policy: same-origin
- Cross-Origin-Resource-Policy: same-origin

## Audit Log

All security-relevant events are written to an **immutable** Firestore audit log at `users/{userId}/audit_log/{eventId}`:

- Login success / failure / blocked
- Logout
- Step-up completed / failed
- Password vault access, reveal, copy
- Document upload / download / delete
- Financial data access
- Data export
- Security settings changes

Audit events include hashed IP addresses (SHA-256), user agent, timestamp, and non-sensitive metadata. Sensitive values (passwords, tokens, file contents) are never logged.

## Secret Management

| Secret | Storage |
|--------|---------|
| Google Drive OAuth client ID / secret (if enabled) | Google Secret Manager |
| Session encryption key | Google Secret Manager |
| KMS key | Cloud KMS (IAM-restricted) |

Secrets are never committed to source control. Local development uses `.env.local` (gitignored). Production uses Secret Manager references in Cloud Run environment configuration.

## Firestore Security Rules

All client SDK access is denied by default. All database operations go through the server-side Admin SDK with service account credentials scoped to minimum required IAM roles.

## Threat Model

See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for the full STRIDE analysis.

## Reporting

This is a private single-user system. If you discover a security issue, contact the repository owner privately.
