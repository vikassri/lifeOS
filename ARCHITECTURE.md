# Architecture Overview

This document summarizes the Personal Life OS foundation architecture. For the full design specification, see [docs/superpowers/specs/2026-09-12-personal-life-os-foundation-design.md](docs/superpowers/specs/2026-09-12-personal-life-os-foundation-design.md).

## High-Level Design

Life OS is a **Next.js 14 full-stack application** deployed on **Cloud Run** in `asia-southeast1`. The browser never receives database credentials, OAuth tokens, or encryption keys — only shaped API responses and an encrypted HTTP-only session cookie.

```
Browser (Client Components, no secrets)
        │ HTTPS (TLS 1.3)
        ▼
Cloud Run — Next.js App Router
  ├── /app/(auth)/       Login page, OAuth callback
  ├── /app/(vault)/      Protected pages (Server Components)
  ├── /app/api/auth/     Google OAuth PKCE handler
  ├── /app/api/v1/       REST API route handlers
  ├── lib/auth/          Session middleware + allowlist
  ├── lib/encryption/    KMS envelope encryption
  ├── lib/db/            Firestore client (server-side only)
  ├── lib/audit/         Immutable audit log writer
  └── lib/security/      CSRF, rate-limit, headers
        │
        ├── Firestore (asia-southeast1)
        ├── Cloud Storage (documents + backups)
        └── Secret Manager + Cloud KMS
```

## Authentication

- **Google OAuth 2.0 with PKCE** — server-side only; tokens are discarded after fetching user info
- **iron-session** — AES-256-CBC encrypted cookie, 8-hour max age, sliding window refresh
- **Server-side allowlist** — only `er.vikassri@gmail.com` is authorized
- **Step-up authentication** — 15-minute elevated window required for sensitive routes (password vault, finance, export)

## API Middleware Chain

Every `/app/api/v1/*` route runs a zero-trust chain:

1. Rate limiter (per IP)
2. CSRF token check (double-submit cookie)
3. Session validation
4. Allowlist check
5. Step-up check (when required)
6. Zod schema validation
7. Business logic
8. Audit log (fire-and-forget)

## Encryption

**Envelope encryption** via Cloud KMS:

1. Generate a random 32-byte DEK per record
2. Encrypt data with AES-256-GCM using the DEK
3. Encrypt the DEK with the Cloud KMS KEK
4. Store ciphertext, encrypted DEK, IV, and AAD in Firestore

Documents in GCS use CMEK (KMS-managed customer encryption keys).

## Data Model

All documents live under `users/{userId}/` where `userId` is the Google `sub` (subject ID). The foundation layer includes:

- `profile/settings` — app preferences
- `audit_log/{eventId}` — immutable security events

Firestore security rules deny all client SDK access — all reads and writes go through the server Admin SDK.

## Infrastructure

Managed via Terraform in `terraform/`:

| Resource | Purpose |
|----------|---------|
| Cloud Run | Application hosting |
| Firestore | Document database |
| Cloud KMS | Key encryption key for envelope encryption |
| Secret Manager | OAuth credentials, session secret |
| Cloud Storage | Documents and backups |
| Cloud Monitoring | Auth failure alerts |

## Sub-Project Roadmap

| # | Sub-Project | Status |
|---|-------------|--------|
| 1 | Foundation (auth, encryption, infra) | Current |
| 2 | Content (Journal, Notes, Projects, Documents) | Planned |
| 3 | Finance (Investments, Portfolio, Net Worth) | Planned |
| 4 | Vault+Ops (Password Manager, Backup, Export) | Planned |

Each sub-project builds on the foundation and is independently testable and deployable.
