# Personal Life OS — Sub-Project 1: Foundation Design Spec

**Date:** 2026-09-12
**Author:** er.vikassri@gmail.com
**Status:** Approved

---

## Overview

A private, single-user Personal Life OS and Digital Vault hosted on Google Cloud.
This document covers **Sub-Project 1: Foundation** — the secure base that all
future sub-projects (Content, Finance, Vault+Ops) are built upon.

**Authorized user:** `er.vikassri@gmail.com` (hardcoded server-side allowlist)
**Region:** `asia-southeast1` (Singapore)

---

## Sub-Project Decomposition

The full system is decomposed into 4 independent build cycles:

| # | Sub-Project | Builds On |
|---|-------------|-----------|
| 1 | **Foundation** (this spec) | — |
| 2 | Content (Journal, Notes, Projects, Documents, Search) | Sub-Project 1 |
| 3 | Finance (Investments, Portfolio, Net Worth) | Sub-Project 1 |
| 4 | Vault+Ops (Password Manager, Backup, Export, Security Tests) | Sub-Projects 1–3 |

Each sub-project produces independently testable, deployable software.

---

## 1. System Architecture

### Option Selected: Next.js Full-Stack on Cloud Run (Option A)

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
│  Next.js Client Components (no secrets, no DB access)        │
│  HTTP-only session cookie only — nothing sensitive in JS     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (TLS 1.3 only)
┌──────────────────────▼──────────────────────────────────────┐
│              CLOUD RUN (asia-southeast1)                     │
│  Next.js 14 App Router — Node.js container                   │
│  ├── /app/(auth)/        Login page, OAuth callback          │
│  ├── /app/(vault)/       Protected pages (Server Components) │
│  ├── /app/api/auth/      Google OAuth PKCE handler           │
│  ├── /app/api/v1/        REST API route handlers             │
│  ├── lib/auth/           Session middleware + allowlist      │
│  ├── lib/encryption/     KMS envelope encryption             │
│  ├── lib/db/             Firestore client (server-side only) │
│  ├── lib/audit/          Immutable audit log writer          │
│  └── lib/security/       CSRF, rate-limit, headers          │
└──────────┬──────────────┬────────────┬───────────────────────┘
           │              │            │
    ┌──────▼──────┐ ┌─────▼────┐ ┌───▼──────────┐
    │  Firestore  │ │   GCS    │ │ Secret Mgr   │
    │ asia-se1    │ │ asia-se1 │ │ + KMS keys   │
    └─────────────┘ └──────────┘ └──────────────┘
           │
    ┌──────▼──────────────┐
    │  Cloud Logging      │
    │  Cloud Monitoring   │
    └─────────────────────┘
```

### Core Security Principle

The browser **never** receives:
- A Firestore SDK or credentials
- A Google OAuth token (access_token, id_token, refresh_token)
- An encryption key
- Raw database query results (only shaped API responses)

---

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| UI Components | shadcn/ui + Radix UI | latest |
| Session | iron-session | 8.x |
| Validation | Zod | 3.x |
| ORM / DB | Firestore Admin SDK | latest |
| Encryption | Node.js crypto (AES-256-GCM) + Cloud KMS | — |
| Container | Docker (node:22-alpine) | — |
| IaC | Terraform | 1.5.x |
| CI/CD | GitHub Actions | — |
| Testing | Vitest + Playwright | latest |

---

## 3. Authentication Design

### Flow (Google OAuth 2.0 with PKCE, server-side only)

```
1.  User visits https://vault.yourdomain.com
2.  Edge middleware checks for valid iron-session cookie
3.  No valid session → 302 redirect to /login
4.  User clicks "Sign in with Google"
5.  Server generates:
      code_verifier  = crypto.randomBytes(32).toString('base64url')
      code_challenge = SHA256(code_verifier)  [base64url]
      state          = crypto.randomBytes(16).toString('hex')
    Stores both in a short-lived server-side session (5 min TTL)
6.  Server redirects browser to Google OAuth endpoint:
      response_type = code
      client_id     = $OAUTH_CLIENT_ID
      redirect_uri  = https://vault.yourdomain.com/api/auth/callback
      scope         = openid email profile
      code_challenge (PKCE)
      code_challenge_method = S256
      state         (CSRF token)
      prompt        = select_account
7.  Google redirects to /api/auth/callback?code=...&state=...
8.  Server validates:
      a. state matches session state (CSRF check)
      b. code_verifier is present in session
      c. Exchanges code for tokens (POST to Google, server-side)
      d. Fetches /userinfo from Google
      e. Checks: email ∈ ALLOWLIST
      f. If not in allowlist → destroy session, return 403, log event
9.  Server creates iron-session:
      { sub, email, iat: now, exp: now + 8h, stepUpExpiry: null }
      Cookie: HttpOnly, Secure, SameSite=Lax, Path=/
      Note: Google tokens are NOT stored in session
10. 302 redirect to /dashboard
11. Audit log: { event: "login_success", sub, email, ip, ua, ts }
```

### Step-up Authentication

Required before accessing:
- Password Vault (`/vault/passwords`)
- Financial data (`/vault/finance`)
- Export (`/vault/settings/export`)
- Permanent delete operations
- Security settings

Implementation:
```typescript
// Session field
stepUpExpiry: number | null  // Unix timestamp, 15-min window

// Middleware check
if (!session.stepUpExpiry || Date.now() > session.stepUpExpiry) {
  // Re-trigger OAuth with prompt=consent
  // After callback, set stepUpExpiry = Date.now() + 15 * 60 * 1000
}
```

### Session Properties

| Property | Value |
|----------|-------|
| Encryption | AES-256-CBC (iron-session) |
| Cookie | HttpOnly, Secure, SameSite=Lax |
| Max age | 8 hours |
| Rotation | Sliding window — refreshed on every authenticated request |
| Logout | Cookie cleared + audit log event |

### Allowlist (server-side only, never in client bundle)

```typescript
// lib/auth/allowlist.ts  (server-only)
const AUTHORIZED_EMAILS = new Set([
  "er.vikassri@gmail.com",
])
```

---

## 4. Middleware Chain (Zero-Trust)

Every `/app/api/v1/*` route runs this chain:

```
Request
  ↓
[1] Rate Limiter          — in-memory (upstash/redis for prod), per IP
  ↓
[2] CSRF Token Check      — double-submit cookie pattern
  ↓
[3] Session Validation    — iron-session cookie, verify not expired
  ↓
[4] Allowlist Check       — email ∈ AUTHORIZED_EMAILS
  ↓
[5] Step-up Check         — if route requires elevated auth
  ↓
[6] Zod Schema Validation — reject malformed input before business logic
  ↓
[7] Business Logic
  ↓
[8] Audit Log             — record event (non-blocking, fire-and-forget)
  ↓
Response (never leaks stack traces, DB errors, or sensitive data)
```

---

## 5. Encryption Architecture

### Model: Envelope Encryption via Cloud KMS

```
Plaintext sensitive data
        ↓
AES-256-GCM encryption
(DEK = Data Encryption Key, generated per-record, random 32 bytes)
        ↓
DEK encrypted by Cloud KMS KEK (Key Encryption Key)
        ↓
Stored in Firestore document:
  {
    ciphertext:   base64(encrypted data),
    encryptedDEK: base64(KMS-encrypted DEK),
    iv:           base64(12-byte random IV),
    aad:          base64(additional auth data: docId + userId),
    keyVersion:   "1",
    encryptedAt:  timestamp
  }
```

### Encryption Coverage

| Data | Encryption Level |
|------|-----------------|
| Password vault entries | App-level AES-256-GCM + KMS envelope |
| Journal entries | App-level AES-256-GCM + KMS envelope |
| Sensitive notes (flagged) | App-level AES-256-GCM + KMS envelope |
| Financial account identifiers | App-level AES-256-GCM + KMS envelope |
| Documents (GCS) | GCS CMEK (KMS-managed) |
| Non-sensitive metadata | Firestore default (Google-managed AES-256) |
| All data in transit | TLS 1.3 |

### KMS Configuration

```
Key Ring: life-os-keyring  (asia-southeast1)
Key:      data-encryption-key
  Purpose:   ENCRYPT_DECRYPT
  Algorithm: GOOGLE_SYMMETRIC_ENCRYPTION (AES-256-GCM)
  Rotation:  365 days
  Access:    Cloud Run SA only (roles/cloudkms.cryptoKeyEncrypterDecrypter)
```

---

## 6. Firestore Data Model (Foundation)

All documents live under `users/{userId}/` — userId is the Google `sub` (subject),
never the email address.

```
users/{userId}/
  profile/
    settings          — app preferences, theme, timezone
  audit_log/
    {eventId}         — immutable security events
      event:    string
      sub:      string
      email:    string (hashed in prod)
      ip:       string
      ua:       string
      ts:       Timestamp
      metadata: object (no sensitive values)
```

Future sub-projects add their own subcollections under `users/{userId}/`.

### Firestore Security Rules

```javascript
// All rules deny by default — no client SDK access is expected
// These rules exist as defense-in-depth if rules are ever tested
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Deny all client access — all access is via server Admin SDK
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 7. Google Cloud Infrastructure (Terraform)

### Resources

```hcl
# APIs enabled
Cloud Run API, Firestore API, Cloud KMS API,
Secret Manager API, Cloud Storage API,
Cloud Logging API, Cloud Monitoring API,
IAM API, Cloud Build API

# Service Account (Cloud Run runtime)
google_service_account "vault_sa"
  roles:
    - roles/datastore.user
    - roles/storage.objectAdmin
    - roles/secretmanager.secretAccessor
    - roles/cloudkms.cryptoKeyEncrypterDecrypter
    - roles/logging.logWriter

# KMS
google_kms_key_ring "life_os_keyring"     asia-southeast1
google_kms_crypto_key "data_key"          365-day rotation

# Secrets (values set manually, not in Terraform state)
google_secret_manager_secret "oauth_client_id"
google_secret_manager_secret "oauth_client_secret"
google_secret_manager_secret "session_secret"        # 64-byte random hex
google_secret_manager_secret "allowed_emails"        # JSON array

# Firestore
google_firestore_database "default"
  location_id = "asia-southeast1"
  type        = "FIRESTORE_NATIVE"

# Cloud Storage
google_storage_bucket "documents"
  location       = "ASIA-SOUTHEAST1"
  versioning     = enabled
  cmek_key       = data_key
  public_access  = blocked
  cors           = none

google_storage_bucket "backups"
  location       = "ASIA"          # multi-region
  versioning     = enabled
  retention_days = 90

# Cloud Run
google_cloud_run_v2_service "vault"
  region           = asia-southeast1
  ingress          = INGRESS_TRAFFIC_ALL
  min_instances    = 0
  max_instances    = 3
  cpu              = 1000m
  memory           = 512Mi
  service_account  = vault_sa
  env_from_secrets = [oauth_client_id, oauth_client_secret,
                      session_secret, allowed_emails]
  liveness_probe   = /api/health

# Cloud Armor (basic rate-limiting policy)
google_compute_security_policy "vault_armor"
  rate_limit: 100 req/min per IP
  default action: allow

# Monitoring alerts
google_monitoring_alert_policy "auth_failures"
  trigger: >5 failed auth events in 5 minutes → email er.vikassri@gmail.com
```

### Environments

| Environment | Terraform Workspace | KMS Key | GCS Bucket |
|-------------|-------------------|---------|-----------|
| dev | dev | dev-data-key | life-os-dev-docs |
| staging | staging | staging-data-key | life-os-staging-docs |
| prod | prod | prod-data-key | life-os-prod-docs |

---

## 8. HTTP Security Headers

Set in `next.config.ts` headers + Edge Middleware:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{nonce}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://lh3.googleusercontent.com;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';

Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

---

## 9. Audit Log Design

### Events Logged

| Event | Sensitive Fields Excluded |
|-------|--------------------------|
| login_success | passwords, tokens |
| login_failed | passwords, tokens |
| logout | — |
| step_up_completed | — |
| step_up_failed | — |
| password_vault_accessed | vault contents |
| password_revealed | password value |
| password_copied | password value |
| document_uploaded | file contents |
| document_downloaded | file contents |
| document_deleted | file contents |
| financial_data_accessed | account numbers |
| data_exported | export contents |
| security_settings_changed | — |

### Audit Event Schema

```typescript
interface AuditEvent {
  id:        string        // crypto.randomUUID()
  event:     AuditEventType
  sub:       string        // Google subject ID (not email)
  ipHash:    string        // SHA-256 of IP (privacy-preserving)
  userAgent: string
  timestamp: FirestoreTimestamp
  metadata:  Record<string, string | number | boolean>  // no sensitive values
  immutable: true
}
```

Firestore document path: `users/{userId}/audit_log/{eventId}`
Firestore rule: write-only via Admin SDK, never deletable via client.

---

## 10. CI/CD Pipeline (GitHub Actions)

```yaml
# On push to main:
1. lint (ESLint + TypeScript type-check)
2. test:unit (Vitest)
3. test:integration (Vitest + Firestore emulator)
4. security:audit (npm audit --audit-level=high)
5. security:semgrep (Semgrep with security ruleset)
6. docker:build + docker:push (to Artifact Registry)
7. terraform:plan (staging workspace)
8. terraform:apply (staging — auto)
9. test:e2e:staging (Playwright against staging URL)
10. deploy:prod (manual approval gate)
11. terraform:apply (prod — after approval)
```

---

## 11. Project Structure

```
personal-life-os/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx        # Login page
│   │   └── layout.tsx
│   ├── (vault)/
│   │   ├── dashboard/page.tsx    # Protected dashboard
│   │   ├── layout.tsx            # Auth wrapper
│   │   └── loading.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts    # Initiate OAuth
│   │   │   ├── callback/route.ts # OAuth callback
│   │   │   └── logout/route.ts
│   │   ├── v1/
│   │   │   └── health/route.ts   # Cloud Run health check
│   │   └── csrf/route.ts         # CSRF token endpoint
│   ├── globals.css
│   └── layout.tsx                # Root layout + security headers
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── auth/
│   │   └── LoginButton.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       └── DashboardShell.tsx
├── lib/
│   ├── auth/
│   │   ├── session.ts            # iron-session config
│   │   ├── middleware.ts         # Auth middleware
│   │   ├── allowlist.ts          # AUTHORIZED_EMAILS (server-only)
│   │   └── step-up.ts            # Step-up auth logic
│   ├── encryption/
│   │   ├── kms.ts                # Cloud KMS client
│   │   ├── envelope.ts           # Envelope encrypt/decrypt
│   │   └── types.ts
│   ├── db/
│   │   ├── client.ts             # Firestore Admin SDK (singleton)
│   │   └── collections.ts        # Collection path constants
│   ├── audit/
│   │   └── log.ts                # Audit log writer
│   ├── security/
│   │   ├── csrf.ts               # CSRF token generation/validation
│   │   ├── rate-limit.ts         # In-memory rate limiter
│   │   ├── headers.ts            # Security header builder
│   │   └── sanitize.ts           # Input sanitization helpers
│   └── errors/
│       └── api-error.ts          # Safe error types (no leakage)
├── middleware.ts                  # Next.js Edge Middleware (auth gate)
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── iam.tf
│   ├── kms.tf
│   ├── firestore.tf
│   ├── storage.tf
│   ├── secrets.tf
│   ├── cloudrun.tf
│   ├── monitoring.tf
│   └── environments/
│       ├── dev.tfvars
│       ├── staging.tfvars
│       └── prod.tfvars
├── tests/
│   ├── unit/
│   │   ├── auth/
│   │   │   ├── allowlist.test.ts
│   │   │   ├── session.test.ts
│   │   │   └── step-up.test.ts
│   │   ├── encryption/
│   │   │   └── envelope.test.ts
│   │   └── security/
│   │       ├── csrf.test.ts
│   │       └── rate-limit.test.ts
│   ├── integration/
│   │   ├── auth-flow.test.ts     # Full OAuth flow with mock
│   │   └── middleware-chain.test.ts
│   └── e2e/
│       ├── login.spec.ts
│       ├── logout.spec.ts
│       └── auth-protection.spec.ts
├── docs/
│   ├── superpowers/specs/        # This document
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   └── THREAT_MODEL.md
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── Dockerfile
├── .dockerignore
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── package.json
```

---

## 12. Threat Model Summary (STRIDE — Foundation Layer)

| Threat | Category | Mitigation |
|--------|----------|-----------|
| OAuth token theft via XSS | Spoofing | Tokens never in browser; CSP; HttpOnly cookies |
| Session fixation | Spoofing | New session on login; session rotation |
| CSRF on API routes | Tampering | Double-submit CSRF token |
| MITM / token interception | Info Disclosure | TLS 1.3 only; HSTS preload |
| Unauthorized API access | Elevation of Privilege | Server-side allowlist on every request |
| Insecure Direct Object Reference | Elevation of Privilege | userId from session, never from input |
| KMS key compromise | Info Disclosure | Least-privilege IAM; key rotation; audit trail |
| OAuth client secret leak | Info Disclosure | Secret Manager only; never in code/env |
| Brute-force login | Denial of Service | Cloud Armor rate limiting; Google handles brute-force |
| Open redirect after auth | Spoofing | Redirect target validated against allowlist of paths |
| Malicious GCS upload | Tampering | MIME + magic bytes + size validation; signed URLs only |

**Residual risks acknowledged:**
- Compromise of Google account itself (mitigated by Google's 2FA)
- Cloud Run container escape (Google-managed infrastructure risk)
- KMS key mismanagement (operator responsibility)

---

## 13. Testing Strategy

### Unit Tests (Vitest)
- allowlist: rejects unauthorized emails, accepts authorized email
- session: creates, validates, expires, rotates correctly
- step-up: grants/denies based on stepUpExpiry
- envelope encryption: encrypt→decrypt roundtrip, wrong key fails
- CSRF: valid token passes, replayed token fails, missing token fails
- rate-limiter: allows under limit, blocks over limit

### Integration Tests (Vitest + Firestore Emulator)
- Full OAuth callback flow (with mocked Google endpoints)
- Middleware chain: each step blocks correctly
- Audit log: events written, immutable in emulator

### E2E Tests (Playwright)
- Login redirects unauthenticated user to /login
- Successful Google login → /dashboard
- Logout clears session and redirects to /login
- Direct navigation to /vault/* without session → /login
- Step-up prompt appears for protected routes

---

## 14. Estimated Monthly Cost

| Service | Usage Assumption | Cost/month |
|---------|-----------------|-----------|
| Cloud Run | ~1h active/day, 0.5 vCPU | ~$1–2 |
| Firestore | < 50k reads, 20k writes/day | $0 (free tier) |
| Cloud Storage | 10 GB documents | ~$0.23 |
| Cloud KMS | 1 key, ~2k ops/month | ~$0.12 |
| Secret Manager | 6 secrets, ~1k accesses | ~$0.36 |
| Cloud Logging | < 50 GB/month | $0 (free tier) |
| Cloud Monitoring | Basic metrics | $0 |
| **Total** | | **~$2–5/month** |

---

## 15. Pre-Production Checklist

- [ ] Google Cloud project created with billing enabled
- [ ] OAuth 2.0 credentials created (Web application type)
- [ ] Authorized redirect URI: `https://vault.yourdomain.com/api/auth/callback`
- [ ] `er.vikassri@gmail.com` added to Test Users in OAuth consent screen
- [ ] All secrets populated in Secret Manager (not in code)
- [ ] KMS key ring and key created via Terraform
- [ ] Firestore security rules deployed (deny all client access)
- [ ] Cloud Run SA has only required IAM roles
- [ ] Custom domain mapped to Cloud Run service
- [ ] HTTPS forced (Cloud Run default)
- [ ] HSTS preload submitted
- [ ] All unit + integration + E2E tests passing
- [ ] npm audit shows no high/critical vulnerabilities
- [ ] Semgrep security scan shows no findings
- [ ] Cloud Monitoring alert for auth failures configured
- [ ] Backup bucket retention policy active
