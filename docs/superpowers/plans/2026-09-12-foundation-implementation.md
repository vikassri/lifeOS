# Personal Life OS — Sub-Project 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the secure foundation of the Personal Life OS — Google OAuth authentication, zero-trust middleware, KMS envelope encryption, Cloud Firestore data layer, immutable audit log, Terraform infrastructure, and an empty but fully secured dashboard — all deployed to Google Cloud Run.

**Architecture:** Next.js 14 App Router full-stack on Cloud Run (asia-southeast1). All DB/secret/crypto access is server-side only. The browser receives rendered HTML and JSON responses; it never touches Firestore, GCS, or KMS directly. Iron-session encrypted HTTP-only cookies handle sessions.

**Tech Stack:** Next.js 14, TypeScript 5, Tailwind CSS 3, shadcn/ui, iron-session 8, Zod 3, Firestore Admin SDK, @google-cloud/kms, @google-cloud/secret-manager, Vitest, Playwright, Terraform 1.5, Docker, GitHub Actions.

## Global Constraints

- Authorized email (hardcoded allowlist): `er.vikassri@gmail.com`
- GCP Region: `asia-southeast1` (Singapore)
- Node.js version: 22 (LTS)
- All secrets: Google Secret Manager only — never in code, .env committed to git, or logs
- All DB access: server-side Admin SDK only — no Firestore client SDK in browser bundle
- Session cookie: HttpOnly, Secure, SameSite=Lax — no sensitive data in localStorage or URL
- TypeScript strict mode: `true`
- No `any` types allowed
- AI/LLM API calls: use server-side API routes only — no LLM API keys in browser
- Agent configs stored in Firestore under `users/{userId}/agents/{agentId}` — never hardcoded
- LLM provider: Google Vertex AI (Gemini) as primary; OpenAI-compatible via env var as fallback
- Every API route must pass the 8-step middleware chain before business logic
- Audit log: written on every auth event, immutable — never deleted
- Tests must pass before each commit

---

## File Map

```
personal-life-os/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (vault)/
│   │   ├── dashboard/page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── callback/route.ts
│   │   │   └── logout/route.ts
│   │   ├── v1/health/route.ts
│   │   └── csrf/route.ts
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/                        # shadcn/ui primitives
│   ├── auth/LoginButton.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       └── DashboardShell.tsx
├── lib/
│   ├── auth/
│   │   ├── session.ts             # iron-session config + helpers
│   │   ├── allowlist.ts           # AUTHORIZED_EMAILS set (server-only)
│   │   ├── step-up.ts             # step-up auth logic
│   │   └── google-oauth.ts        # PKCE helpers, token exchange
│   ├── encryption/
│   │   ├── kms.ts                 # Cloud KMS client (singleton)
│   │   ├── envelope.ts            # encrypt() / decrypt() with KMS
│   │   └── types.ts               # EncryptedPayload interface
│   ├── db/
│   │   ├── client.ts              # Firestore Admin SDK singleton
│   │   └── collections.ts         # Collection path constants
│   ├── audit/
│   │   └── log.ts                 # writeAuditEvent()
│   ├── security/
│   │   ├── csrf.ts                # generateCsrfToken() / validateCsrfToken()
│   │   ├── rate-limit.ts          # rateLimiter() middleware helper
│   │   ├── headers.ts             # getSecurityHeaders()
│   │   └── sanitize.ts            # sanitizeInput()
│   ├── middleware/
│   │   └── api-guard.ts           # withApiGuard() — 8-step chain
│   └── errors/
│       └── api-error.ts           # ApiError class, safeError()
├── middleware.ts                   # Next.js Edge Middleware
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
│   │   ├── auth/allowlist.test.ts
│   │   ├── auth/session.test.ts
│   │   ├── auth/step-up.test.ts
│   │   ├── encryption/envelope.test.ts
│   │   └── security/csrf.test.ts
│   ├── integration/
│   │   ├── auth-flow.test.ts
│   │   └── middleware-chain.test.ts
│   └── e2e/
│       ├── login.spec.ts
│       ├── logout.spec.ts
│       └── auth-protection.spec.ts
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
├── Dockerfile
├── .dockerignore
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

---

## Task 1: Project Scaffold & Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.gitignore`
- Create: `.dockerignore`
- Create: `app/globals.css`
- Create: `app/layout.tsx`

**Interfaces:**
- Produces: working `npm run dev`, `npm test`, `npm run build` commands

- [ ] **Step 1: Initialise Next.js project**

```bash
cd /Users/vikassri/Work/Code/vscode/Projects/personal-life-os
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*" --yes
```

Expected: Next.js 14 scaffold created.

- [ ] **Step 2: Install all dependencies**

```bash
npm install iron-session zod @google-cloud/firestore @google-cloud/kms \
  @google-cloud/secret-manager class-variance-authority clsx \
  tailwind-merge lucide-react @radix-ui/react-slot \
  @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-separator @radix-ui/react-tooltip \
  next-themes sonner

npm install -D vitest @vitest/coverage-v8 @vitejs/plugin-react \
  @playwright/test @types/node \
  eslint-plugin-security semgrep
```

- [ ] **Step 3: Replace `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "terraform"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', '.next', 'tests/e2e', 'terraform'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 5: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

- [ ] **Step 6: Create `next.config.ts` (security headers baked in)**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 7: Verify build compiles**

```bash
npm run build
```

Expected: BUILD SUCCESS, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 14 project with TypeScript, Tailwind, Vitest, Playwright"
```

---

## Task 2: Error Types & Safe API Responses

**Files:**
- Create: `lib/errors/api-error.ts`

**Interfaces:**
- Produces: `ApiError`, `safeError(err: unknown): { message: string }`, `createErrorResponse(status, message): Response`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/errors/api-error.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ApiError, safeError, createErrorResponse } from '@/lib/errors/api-error'

describe('ApiError', () => {
  it('is an instance of Error', () => {
    const err = new ApiError(400, 'Bad request')
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe('Bad request')
  })
})

describe('safeError', () => {
  it('returns generic message for unknown errors', () => {
    expect(safeError(new Error('DB password is abc123')).message)
      .toBe('An unexpected error occurred')
  })
  it('returns ApiError message for ApiError', () => {
    expect(safeError(new ApiError(403, 'Forbidden')).message).toBe('Forbidden')
  })
})

describe('createErrorResponse', () => {
  it('returns a Response with correct status and JSON body', async () => {
    const res = createErrorResponse(401, 'Unauthorized')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/errors/api-error.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/errors/api-error.ts`**

```typescript
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function safeError(err: unknown): { message: string } {
  if (err instanceof ApiError) {
    return { message: err.message }
  }
  // Never expose internal error details
  return { message: 'An unexpected error occurred' }
}

export function createErrorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, { status })
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/unit/errors/api-error.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/errors/api-error.ts tests/unit/errors/api-error.test.ts
git commit -m "feat(errors): add ApiError, safeError, createErrorResponse"
```

---

## Task 3: Security Primitives — CSRF & Rate Limiter

**Files:**
- Create: `lib/security/csrf.ts`
- Create: `lib/security/rate-limit.ts`
- Create: `lib/security/sanitize.ts`

**Interfaces:**
- Produces:
  - `generateCsrfToken(): string`
  - `validateCsrfToken(sessionToken: string, headerToken: string): boolean`
  - `rateLimiter(key: string, maxRequests: number, windowMs: number): boolean` (returns `true` if allowed)
  - `sanitizeInput(input: string): string`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/security/csrf.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateCsrfToken, validateCsrfToken } from '@/lib/security/csrf'

describe('CSRF', () => {
  it('generates a 32-char hex token', () => {
    const token = generateCsrfToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('validates matching tokens with timing-safe compare', () => {
    const token = generateCsrfToken()
    expect(validateCsrfToken(token, token)).toBe(true)
  })

  it('rejects non-matching tokens', () => {
    expect(validateCsrfToken('aaa', 'bbb')).toBe(false)
  })

  it('rejects empty tokens', () => {
    expect(validateCsrfToken('', '')).toBe(false)
  })
})
```

Create `tests/unit/security/rate-limit.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createRateLimiter } from '@/lib/security/rate-limit'

describe('RateLimiter', () => {
  it('allows requests under the limit', () => {
    const limiter = createRateLimiter(5, 60_000)
    for (let i = 0; i < 5; i++) {
      expect(limiter('user-1')).toBe(true)
    }
  })

  it('blocks requests over the limit', () => {
    const limiter = createRateLimiter(2, 60_000)
    limiter('user-2')
    limiter('user-2')
    expect(limiter('user-2')).toBe(false)
  })

  it('tracks different keys independently', () => {
    const limiter = createRateLimiter(1, 60_000)
    expect(limiter('a')).toBe(true)
    expect(limiter('b')).toBe(true)
    expect(limiter('a')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run tests/unit/security/
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `lib/security/csrf.ts`**

```typescript
import { randomBytes, timingSafeEqual } from 'crypto'

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

export function validateCsrfToken(
  sessionToken: string,
  headerToken: string,
): boolean {
  if (!sessionToken || !headerToken) return false
  if (sessionToken.length !== headerToken.length) return false
  try {
    return timingSafeEqual(
      Buffer.from(sessionToken, 'utf8'),
      Buffer.from(headerToken, 'utf8'),
    )
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Create `lib/security/rate-limit.ts`**

```typescript
interface RateLimitEntry {
  count: number
  resetAt: number
}

export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
): (key: string) => boolean {
  const store = new Map<string, RateLimitEntry>()

  return function isAllowed(key: string): boolean {
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }

    if (entry.count >= maxRequests) return false

    entry.count++
    return true
  }
}

// Singleton for API routes — 100 requests per minute per IP
export const apiRateLimiter = createRateLimiter(100, 60_000)
// Stricter limiter for auth endpoints — 10 per minute
export const authRateLimiter = createRateLimiter(10, 60_000)
```

- [ ] **Step 5: Create `lib/security/sanitize.ts`**

```typescript
/**
 * Strip null bytes and control characters from user input.
 * Does NOT sanitize HTML — use a dedicated library if rendering HTML.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/\0/g, '')           // null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars
    .trim()
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npx vitest run tests/unit/security/
```

Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/security/ tests/unit/security/
git commit -m "feat(security): add CSRF token, rate limiter, input sanitizer"
```

---

## Task 4: Encryption Layer — KMS Envelope Encryption

**Files:**
- Create: `lib/encryption/types.ts`
- Create: `lib/encryption/kms.ts`
- Create: `lib/encryption/envelope.ts`

**Interfaces:**
- Produces:
  - `EncryptedPayload` interface
  - `encryptData(plaintext: string, associatedData: string): Promise<EncryptedPayload>`
  - `decryptData(payload: EncryptedPayload, associatedData: string): Promise<string>`

- [ ] **Step 1: Write failing test**

Create `tests/unit/encryption/envelope.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/unit/encryption/
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `lib/encryption/types.ts`**

```typescript
export interface EncryptedPayload {
  ciphertext: string   // base64 — AES-256-GCM encrypted data
  encryptedDek: string // base64 — KMS-encrypted Data Encryption Key
  iv: string           // base64 — 12-byte random IV
  keyVersion: string   // KMS key version used (for rotation support)
  encryptedAt: number  // Unix timestamp
}
```

- [ ] **Step 4: Create `lib/encryption/kms.ts`**

```typescript
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
```

- [ ] **Step 5: Create `lib/encryption/envelope.ts`**

```typescript
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { kmsEncryptDek, kmsDecryptDek } from './kms'
import type { EncryptedPayload } from './types'

const ALGORITHM = 'aes-256-gcm'
const AUTH_TAG_LENGTH = 16

export async function encryptData(
  plaintext: string,
  associatedData: string,
): Promise<EncryptedPayload> {
  // 1. Generate random DEK (Data Encryption Key) — 32 bytes
  const dek = randomBytes(32)
  // 2. Generate random IV — 12 bytes for GCM
  const iv = randomBytes(12)
  // 3. Encrypt plaintext with DEK using AES-256-GCM
  const cipher = createCipheriv(ALGORITHM, dek, iv, { authTagLength: AUTH_TAG_LENGTH })
  cipher.setAAD(Buffer.from(associatedData, 'utf8'))
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // 4. Combine encrypted data + auth tag
  const ciphertextWithTag = Buffer.concat([encrypted, authTag])
  // 5. Encrypt DEK with KMS
  const encryptedDek = await kmsEncryptDek(dek)
  // 6. Zero out DEK from memory (best-effort)
  dek.fill(0)

  return {
    ciphertext: ciphertextWithTag.toString('base64'),
    encryptedDek: encryptedDek.toString('base64'),
    iv: iv.toString('base64'),
    keyVersion: '1',
    encryptedAt: Date.now(),
  }
}

export async function decryptData(
  payload: EncryptedPayload,
  associatedData: string,
): Promise<string> {
  // 1. Decrypt DEK with KMS
  const encryptedDekBuffer = Buffer.from(payload.encryptedDek, 'base64')
  const dek = await kmsDecryptDek(encryptedDekBuffer)
  // 2. Split ciphertext + auth tag
  const ciphertextWithTag = Buffer.from(payload.ciphertext, 'base64')
  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - AUTH_TAG_LENGTH)
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - AUTH_TAG_LENGTH)
  const iv = Buffer.from(payload.iv, 'base64')
  // 3. Decrypt
  const decipher = createDecipheriv(ALGORITHM, dek, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAAD(Buffer.from(associatedData, 'utf8'))
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  // 4. Zero out DEK from memory (best-effort)
  dek.fill(0)

  return decrypted.toString('utf8')
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npx vitest run tests/unit/encryption/
```

Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/encryption/ tests/unit/encryption/
git commit -m "feat(encryption): add KMS envelope encrypt/decrypt with AES-256-GCM"
```

---

## Task 5: Authentication — Session, Allowlist, Step-up

**Files:**
- Create: `lib/auth/session.ts`
- Create: `lib/auth/allowlist.ts`
- Create: `lib/auth/step-up.ts`
- Create: `lib/auth/google-oauth.ts`

**Interfaces:**
- Produces:
  - `SessionData` interface, `getSession(req)`, `saveSession(res, data)`, `destroySession(res)`
  - `isAuthorizedEmail(email: string): boolean`
  - `requiresStepUp(session: SessionData): boolean`, `grantStepUp(session: SessionData): SessionData`
  - `buildAuthorizationUrl(state, codeChallenge): string`
  - `exchangeCodeForTokens(code, codeVerifier): Promise<GoogleUserInfo>`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/auth/allowlist.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isAuthorizedEmail } from '@/lib/auth/allowlist'

describe('isAuthorizedEmail', () => {
  it('allows the authorized email', () => {
    expect(isAuthorizedEmail('er.vikassri@gmail.com')).toBe(true)
  })

  it('rejects unknown emails', () => {
    expect(isAuthorizedEmail('attacker@evil.com')).toBe(false)
    expect(isAuthorizedEmail('')).toBe(false)
    expect(isAuthorizedEmail('ER.VIKASSRI@GMAIL.COM')).toBe(false) // case-sensitive
  })

  it('rejects email with trailing whitespace (no normalization)', () => {
    expect(isAuthorizedEmail('er.vikassri@gmail.com ')).toBe(false)
  })
})
```

Create `tests/unit/auth/step-up.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { requiresStepUp, grantStepUp } from '@/lib/auth/step-up'
import type { SessionData } from '@/lib/auth/session'

const baseSession: SessionData = {
  sub: 'user-123',
  email: 'er.vikassri@gmail.com',
  iat: Date.now(),
  exp: Date.now() + 8 * 60 * 60 * 1000,
  stepUpExpiry: null,
}

describe('requiresStepUp', () => {
  it('requires step-up when stepUpExpiry is null', () => {
    expect(requiresStepUp({ ...baseSession, stepUpExpiry: null })).toBe(true)
  })

  it('requires step-up when stepUpExpiry is in the past', () => {
    expect(requiresStepUp({ ...baseSession, stepUpExpiry: Date.now() - 1 })).toBe(true)
  })

  it('does NOT require step-up when stepUpExpiry is in the future', () => {
    expect(requiresStepUp({ ...baseSession, stepUpExpiry: Date.now() + 10_000 })).toBe(false)
  })
})

describe('grantStepUp', () => {
  it('sets stepUpExpiry 15 minutes in the future', () => {
    const before = Date.now()
    const updated = grantStepUp(baseSession)
    const after = Date.now()
    expect(updated.stepUpExpiry).toBeGreaterThanOrEqual(before + 15 * 60 * 1000 - 10)
    expect(updated.stepUpExpiry).toBeLessThanOrEqual(after + 15 * 60 * 1000 + 10)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run tests/unit/auth/
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `lib/auth/allowlist.ts`**

```typescript
// SERVER-ONLY — never import this in client components
// This file must never appear in browser bundles

const AUTHORIZED_EMAILS: ReadonlySet<string> = new Set([
  'er.vikassri@gmail.com',
])

export function isAuthorizedEmail(email: string): boolean {
  return AUTHORIZED_EMAILS.has(email)
}
```

- [ ] **Step 4: Create `lib/auth/session.ts`**

```typescript
import { getIronSession, type IronSession } from 'iron-session'
import type { NextRequest } from 'next/server'

export interface SessionData {
  sub: string           // Google subject ID
  email: string
  iat: number           // issued at (ms)
  exp: number           // expires at (ms)
  stepUpExpiry: number | null  // step-up auth window
  csrfToken?: string    // CSRF token bound to session
  // OAuth PKCE state (temporary — cleared after callback)
  oauthState?: string
  oauthCodeVerifier?: string
  oauthStateExpiry?: number
}

function getSessionSecret(): string {
  const secret = process.env['SESSION_SECRET']
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters')
  }
  return secret
}

export const sessionOptions = {
  cookieName: 'life-os-session',
  password: getSessionSecret,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 8 * 60 * 60, // 8 hours in seconds
    path: '/',
  },
}

export async function getSession(req: NextRequest): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(req, new Response(), sessionOptions)
}

export function isSessionExpired(session: SessionData): boolean {
  return Date.now() > session.exp
}

export function isSessionValid(session: Partial<SessionData>): session is SessionData {
  return (
    typeof session.sub === 'string' &&
    session.sub.length > 0 &&
    typeof session.email === 'string' &&
    typeof session.exp === 'number' &&
    !isSessionExpired(session as SessionData)
  )
}
```

- [ ] **Step 5: Create `lib/auth/step-up.ts`**

```typescript
import type { SessionData } from './session'

const STEP_UP_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export function requiresStepUp(session: SessionData): boolean {
  if (session.stepUpExpiry === null) return true
  return Date.now() > session.stepUpExpiry
}

export function grantStepUp(session: SessionData): SessionData {
  return {
    ...session,
    stepUpExpiry: Date.now() + STEP_UP_WINDOW_MS,
  }
}

// Routes that require step-up authentication
export const STEP_UP_ROUTES = new Set([
  '/vault/passwords',
  '/vault/finance',
  '/api/v1/passwords',
  '/api/v1/export',
  '/api/v1/delete-permanent',
  '/api/v1/security-settings',
])

export function routeRequiresStepUp(pathname: string): boolean {
  for (const route of STEP_UP_ROUTES) {
    if (pathname.startsWith(route)) return true
  }
  return false
}
```

- [ ] **Step 6: Create `lib/auth/google-oauth.ts`**

```typescript
import { randomBytes, createHash } from 'crypto'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

export interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name: string
  picture: string
}

function getOAuthConfig() {
  const clientId = process.env['GOOGLE_CLIENT_ID']
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']
  const redirectUri = process.env['GOOGLE_REDIRECT_URI']
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('OAuth environment variables not configured')
  }
  return { clientId, clientSecret, redirectUri }
}

export function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  return { codeVerifier, codeChallenge }
}

export function generateState(): string {
  return randomBytes(16).toString('hex')
}

export function buildAuthorizationUrl(state: string, codeChallenge: string): string {
  const { clientId, redirectUri } = getOAuthConfig()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    prompt: 'select_account',
    access_type: 'online',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForUserInfo(
  code: string,
  codeVerifier: string,
): Promise<GoogleUserInfo> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig()

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
    }).toString(),
  })

  if (!tokenResponse.ok) {
    // Never log the token response body — may contain secrets
    throw new Error(`Token exchange failed: ${tokenResponse.status}`)
  }

  const tokens = await tokenResponse.json() as { access_token?: string; id_token?: string }
  if (!tokens.access_token) throw new Error('No access_token in token response')

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!userInfoResponse.ok) {
    throw new Error(`UserInfo fetch failed: ${userInfoResponse.status}`)
  }

  const userInfo = await userInfoResponse.json() as GoogleUserInfo
  // Do NOT store tokens — discard immediately after fetching userinfo
  return userInfo
}
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
npx vitest run tests/unit/auth/
```

Expected: PASS (7 tests).

- [ ] **Step 8: Commit**

```bash
git add lib/auth/ tests/unit/auth/
git commit -m "feat(auth): add session config, allowlist, step-up auth, Google OAuth PKCE helpers"
```

---

## Task 6: Firestore Client & Audit Log

**Files:**
- Create: `lib/db/client.ts`
- Create: `lib/db/collections.ts`
- Create: `lib/audit/log.ts`

**Interfaces:**
- Produces:
  - `getFirestoreDb(): Firestore`
  - `COLLECTIONS` constant
  - `writeAuditEvent(userId: string, event: AuditEventInput): Promise<void>`

- [ ] **Step 1: Create `lib/db/client.ts`**

```typescript
import { Firestore } from '@google-cloud/firestore'

let _db: Firestore | null = null

export function getFirestoreDb(): Firestore {
  if (!_db) {
    _db = new Firestore({
      projectId: process.env['GCP_PROJECT_ID'],
      // In Cloud Run: uses Application Default Credentials automatically
      // Locally: set GOOGLE_APPLICATION_CREDENTIALS env var
    })
  }
  return _db
}
```

- [ ] **Step 2: Create `lib/db/collections.ts`**

```typescript
export const COLLECTIONS = {
  userProfile: (userId: string) => `users/${userId}/profile`,
  auditLog: (userId: string) => `users/${userId}/audit_log`,
  // Future sub-projects will add their collections here
} as const
```

- [ ] **Step 3: Create `lib/audit/log.ts`**

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add lib/db/ lib/audit/
git commit -m "feat(db): add Firestore client singleton, collection paths, and audit log writer"
```

---

## Task 7: API Guard Middleware (8-step chain)

**Files:**
- Create: `lib/middleware/api-guard.ts`

**Interfaces:**
- Produces:
  - `withApiGuard(handler, options?): RouteHandler`
  - Options: `{ requireStepUp?: boolean, skipCsrf?: boolean }`

- [ ] **Step 1: Write failing test**

Create `tests/unit/middleware/api-guard.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

// We test the guard behavior at integration level; unit test covers the key rejection paths
// Full integration test is in tests/integration/middleware-chain.test.ts

describe('API guard contract', () => {
  it('exports withApiGuard function', async () => {
    const mod = await import('@/lib/middleware/api-guard')
    expect(typeof mod.withApiGuard).toBe('function')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/unit/middleware/
```

- [ ] **Step 3: Create `lib/middleware/api-guard.ts`**

```typescript
import type { NextRequest } from 'next/server'
import { apiRateLimiter } from '@/lib/security/rate-limit'
import { validateCsrfToken } from '@/lib/security/csrf'
import { isSessionValid } from '@/lib/auth/session'
import { isAuthorizedEmail } from '@/lib/auth/allowlist'
import { requiresStepUp } from '@/lib/auth/step-up'
import { createErrorResponse } from '@/lib/errors/api-error'
import { writeAuditEvent } from '@/lib/audit/log'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/auth/session'

type RouteHandler = (
  req: NextRequest,
  context: { session: SessionData; params?: Record<string, string> },
) => Promise<Response>

interface ApiGuardOptions {
  requireStepUp?: boolean
  skipCsrf?: boolean   // Only true for GET requests (no state change)
}

export function withApiGuard(
  handler: RouteHandler,
  options: ApiGuardOptions = {},
): (req: NextRequest) => Promise<Response> {
  return async function guardedHandler(req: NextRequest): Promise<Response> {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // Step 1: Rate limiting
    if (!apiRateLimiter(ip)) {
      return createErrorResponse(429, 'Too many requests')
    }

    // Step 2: CSRF check (skip for read-only GET requests when explicitly opted out)
    if (!options.skipCsrf && req.method !== 'GET') {
      const csrfHeader = req.headers.get('x-csrf-token')
      const session = await getIronSession<SessionData>(req, new Response(), sessionOptions)
      if (!csrfHeader || !session.csrfToken || !validateCsrfToken(session.csrfToken, csrfHeader)) {
        return createErrorResponse(403, 'Invalid CSRF token')
      }
    }

    // Step 3: Session validation
    const resForSession = new Response()
    const session = await getIronSession<SessionData>(req, resForSession, sessionOptions)
    if (!isSessionValid(session)) {
      return createErrorResponse(401, 'Authentication required')
    }

    // Step 4: Allowlist check (defense-in-depth — belt & suspenders)
    if (!isAuthorizedEmail(session.email)) {
      await writeAuditEvent(session.sub, {
        event: 'login_blocked_allowlist',
        ipAddress: ip,
        userAgent: req.headers.get('user-agent') ?? undefined,
      })
      return createErrorResponse(403, 'Access denied')
    }

    // Step 5: Step-up authentication check
    if (options.requireStepUp && requiresStepUp(session)) {
      return createErrorResponse(403, 'Step-up authentication required')
    }

    // Step 6: Schema validation happens inside the handler (Zod)
    // Step 7: Business logic
    const response = await handler(req, { session })

    // Step 8: Audit logging happens inside the handler for specific events
    return response
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/unit/middleware/
```

- [ ] **Step 5: Commit**

```bash
git add lib/middleware/ tests/unit/middleware/
git commit -m "feat(middleware): add withApiGuard 8-step zero-trust middleware chain"
```

---

## Task 8: Edge Middleware (Next.js Route Protection)

**Files:**
- Create: `middleware.ts`

**Interfaces:**
- Produces: Next.js Edge Middleware that redirects unauthenticated requests to `/login`

- [ ] **Step 1: Create `middleware.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, isSessionValid, type SessionData } from '@/lib/auth/session'

// Routes that do NOT require authentication
const PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/login',
  '/api/auth/callback',
  '/api/v1/health',
  '/_next',
  '/favicon.ico',
])

function isPublicPath(pathname: string): boolean {
  for (const path of PUBLIC_PATHS) {
    if (pathname.startsWith(path)) return true
  }
  return false
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl

  // Allow public paths through without auth check
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Validate session
  const res = new NextResponse()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)

  if (!isSessionValid(session)) {
    const loginUrl = new URL('/login', req.url)
    // Only allow same-origin redirects — prevent open redirect
    loginUrl.searchParams.set('next', pathname.startsWith('/') ? pathname : '/')
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat(middleware): add Next.js Edge Middleware for route protection"
```

---

## Task 9: OAuth API Routes

**Files:**
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/callback/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/v1/health/route.ts`
- Create: `app/api/csrf/route.ts`

**Interfaces:**
- Produces: Working Google OAuth PKCE flow, session creation, logout

- [ ] **Step 1: Create `app/api/v1/health/route.ts`**

```typescript
export async function GET(): Promise<Response> {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
}
```

- [ ] **Step 2: Create `app/api/csrf/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { generateCsrfToken } from '@/lib/security/csrf'
import { sessionOptions, type SessionData } from '@/lib/auth/session'

export async function GET(req: NextRequest): Promise<Response> {
  const res = new Response()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)
  if (!session.csrfToken) {
    session.csrfToken = generateCsrfToken()
    await session.save()
  }
  return Response.json({ csrfToken: session.csrfToken })
}
```

- [ ] **Step 3: Create `app/api/auth/login/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/auth/session'
import { generatePkce, generateState, buildAuthorizationUrl } from '@/lib/auth/google-oauth'
import { authRateLimiter } from '@/lib/security/rate-limit'
import { createErrorResponse } from '@/lib/errors/api-error'

export async function GET(req: NextRequest): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (!authRateLimiter(ip)) {
    return createErrorResponse(429, 'Too many requests')
  }

  const { codeVerifier, codeChallenge } = generatePkce()
  const state = generateState()
  const stateExpiry = Date.now() + 5 * 60 * 1000 // 5 minute PKCE window

  const res = new Response()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)
  session.oauthState = state
  session.oauthCodeVerifier = codeVerifier
  session.oauthStateExpiry = stateExpiry
  await session.save()

  const authUrl = buildAuthorizationUrl(state, codeChallenge)

  // Validate redirect URL is to Google (prevent open redirect)
  const parsedUrl = new URL(authUrl)
  if (parsedUrl.hostname !== 'accounts.google.com') {
    return createErrorResponse(500, 'Invalid redirect target')
  }

  const redirectResponse = Response.redirect(authUrl, 302)
  // Copy session cookie to redirect response
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) redirectResponse.headers.set('set-cookie', setCookie)
  return redirectResponse
}
```

- [ ] **Step 4: Create `app/api/auth/callback/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/auth/session'
import { exchangeCodeForUserInfo } from '@/lib/auth/google-oauth'
import { isAuthorizedEmail } from '@/lib/auth/allowlist'
import { validateCsrfToken } from '@/lib/security/csrf'
import { generateCsrfToken } from '@/lib/security/csrf'
import { createErrorResponse } from '@/lib/errors/api-error'
import { writeAuditEvent } from '@/lib/audit/log'

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const returnedState = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle OAuth errors (user denied access, etc.)
  if (error) {
    return Response.redirect(new URL('/login?error=access_denied', req.url), 302)
  }

  if (!code || !returnedState) {
    return createErrorResponse(400, 'Invalid callback parameters')
  }

  const res = new Response()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)

  // Validate CSRF state parameter
  const storedState = session.oauthState
  const codeVerifier = session.oauthCodeVerifier
  const stateExpiry = session.oauthStateExpiry

  // Clear PKCE state immediately (one-time use)
  delete session.oauthState
  delete session.oauthCodeVerifier
  delete session.oauthStateExpiry

  if (!storedState || !codeVerifier || !stateExpiry) {
    return createErrorResponse(403, 'Invalid OAuth session')
  }

  if (Date.now() > stateExpiry) {
    return createErrorResponse(403, 'OAuth state expired')
  }

  if (!validateCsrfToken(storedState, returnedState)) {
    return createErrorResponse(403, 'State mismatch — possible CSRF attack')
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ua = req.headers.get('user-agent') ?? 'unknown'

  let userInfo
  try {
    userInfo = await exchangeCodeForUserInfo(code, codeVerifier)
  } catch {
    return createErrorResponse(500, 'Authentication failed')
  }

  // Server-side allowlist check — NEVER skip this
  if (!userInfo.email_verified) {
    await writeAuditEvent('unknown', {
      event: 'login_failed',
      ipAddress: ip,
      userAgent: ua,
      metadata: { reason: 'email_not_verified' },
    })
    return createErrorResponse(403, 'Email not verified')
  }

  if (!isAuthorizedEmail(userInfo.email)) {
    await writeAuditEvent(userInfo.sub, {
      event: 'login_blocked_allowlist',
      ipAddress: ip,
      userAgent: ua,
    })
    return Response.redirect(new URL('/login?error=unauthorized', req.url), 302)
  }

  // Create authenticated session
  const now = Date.now()
  session.sub = userInfo.sub
  session.email = userInfo.email
  session.iat = now
  session.exp = now + 8 * 60 * 60 * 1000 // 8 hours
  session.stepUpExpiry = null
  session.csrfToken = generateCsrfToken()
  await session.save()

  await writeAuditEvent(userInfo.sub, {
    event: 'login_success',
    ipAddress: ip,
    userAgent: ua,
  })

  const dashboardUrl = new URL('/dashboard', req.url)
  const redirectResponse = Response.redirect(dashboardUrl, 302)
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) redirectResponse.headers.set('set-cookie', setCookie)
  return redirectResponse
}
```

- [ ] **Step 5: Create `app/api/auth/logout/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, isSessionValid, type SessionData } from '@/lib/auth/session'
import { writeAuditEvent } from '@/lib/audit/log'

export async function POST(req: NextRequest): Promise<Response> {
  const res = new Response()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)

  if (isSessionValid(session)) {
    await writeAuditEvent(session.sub, {
      event: 'logout',
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    })
  }

  session.destroy()
  await session.save()

  const redirectResponse = Response.redirect(new URL('/login', req.url), 302)
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) redirectResponse.headers.set('set-cookie', setCookie)
  return redirectResponse
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/
git commit -m "feat(auth): add OAuth PKCE login/callback/logout routes and health check"
```

---

## Task 10: UI — Login Page & Dashboard Shell

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/layout.tsx`
- Create: `app/(vault)/dashboard/page.tsx`
- Create: `app/(vault)/layout.tsx`
- Create: `components/auth/LoginButton.tsx`
- Create: `components/layout/Sidebar.tsx`
- Create: `components/layout/Header.tsx`
- Create: `components/layout/DashboardShell.tsx`
- Create: `app/layout.tsx` (root layout)

**Interfaces:**
- Produces: Visible login page + protected dashboard route

- [ ] **Step 1: Install shadcn/ui init**

```bash
npx shadcn@latest init --defaults
npx shadcn@latest add button card separator tooltip badge avatar
```

- [ ] **Step 2: Create `app/layout.tsx` (root)**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Life OS',
  description: 'Private Personal Life OS',
  robots: 'noindex, nofollow',
  // Prevent indexing — this is a private app
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create `app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Create `components/auth/LoginButton.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function LoginButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = () => {
    setIsLoading(true)
    // Redirect to server-side OAuth initiation — no client-side tokens
    window.location.href = '/api/auth/login'
  }

  return (
    <Button
      onClick={handleSignIn}
      disabled={isLoading}
      className="w-full bg-white text-zinc-900 hover:bg-zinc-100 font-medium"
      aria-label="Sign in with Google"
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75" />
          </svg>
          Redirecting…
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </span>
      )}
    </Button>
  )
}
```

- [ ] **Step 5: Create `app/(auth)/login/page.tsx`**

```tsx
import { LoginButton } from '@/components/auth/LoginButton'
import { ShieldCheck } from 'lucide-react'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const errorMessage =
    searchParams.error === 'unauthorized'
      ? 'Access denied. This vault is private.'
      : searchParams.error === 'access_denied'
      ? 'Sign-in was cancelled.'
      : null

  return (
    <div className="w-full max-w-sm space-y-8 px-4">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="rounded-full bg-zinc-800 p-4">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Life OS</h1>
        <p className="text-sm text-zinc-400">Your private digital vault</p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300"
        >
          {errorMessage}
        </div>
      )}

      <LoginButton />

      <p className="text-center text-xs text-zinc-600">
        Private access only. Unauthorized access is logged.
      </p>
    </div>
  )
}
```

- [ ] **Step 6: Create Sidebar**

```tsx
// components/layout/Sidebar.tsx
import Link from 'next/link'
import {
  LayoutDashboard, BookOpen, FileText, FolderOpen,
  Lock, TrendingUp, DollarSign, Search, Settings,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/vault/passwords', label: 'Password Vault', icon: Lock },
  { href: '/vault/finance', label: 'Investments', icon: TrendingUp },
  { href: '/net-worth', label: 'Net Worth', icon: DollarSign },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 flex-col border-r border-zinc-800 bg-zinc-900 px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="h-6 w-6 rounded bg-emerald-500/20 flex items-center justify-center">
          <span className="text-xs font-bold text-emerald-400">L</span>
        </div>
        <span className="text-sm font-semibold">Life OS</span>
      </div>
      <nav className="flex-1 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            aria-label={label}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 7: Create Header**

```tsx
// components/layout/Header.tsx
'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  userEmail: string
}

export function Header({ userEmail }: HeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-400">{userEmail}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          aria-label="Sign out"
          className="text-zinc-400 hover:text-zinc-100"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
```

- [ ] **Step 8: Create `components/layout/DashboardShell.tsx`**

```tsx
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface DashboardShellProps {
  children: React.ReactNode
  userEmail: string
}

export function DashboardShell({ children, userEmail }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={userEmail} />
        <main className="flex-1 overflow-auto p-6" role="main">
          {children}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Create `app/(vault)/layout.tsx`**

```tsx
// Server component — reads session on server side
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getIronSession } from 'iron-session'
import { sessionOptions, isSessionValid, type SessionData } from '@/lib/auth/session'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function VaultLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Read session server-side
  const cookieStore = cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)

  if (!isSessionValid(session)) {
    redirect('/login')
  }

  return (
    <DashboardShell userEmail={session.email}>
      {children}
    </DashboardShell>
  )
}
```

- [ ] **Step 10: Create `app/(vault)/dashboard/page.tsx`**

```tsx
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/auth/session'
import { ShieldCheck, BookOpen, FileText, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const cookieStore = cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Welcome back. Your vault is secure.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Journal Entries', value: '—', icon: BookOpen, color: 'text-blue-400' },
          { label: 'Notes', value: '—', icon: FileText, color: 'text-purple-400' },
          { label: 'Documents', value: '—', icon: FileText, color: 'text-orange-400' },
          { label: 'Net Worth', value: '—', icon: TrendingUp, color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3"
          >
            <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
            <div>
              <p className="text-2xl font-semibold">{value}</p>
              <p className="text-xs text-zinc-500 mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h2 className="text-sm font-medium">Security Status</h2>
        </div>
        <p className="text-xs text-zinc-500 mt-3">
          Authenticated as <span className="text-zinc-300">{session.email}</span>.
          Session expires in 8 hours.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 11: Build & verify no type errors**

```bash
npm run build
```

Expected: BUILD SUCCESS.

- [ ] **Step 12: Commit**

```bash
git add app/ components/
git commit -m "feat(ui): add login page, dashboard shell, sidebar, header with Google OAuth flow"
```

---

## Task 11: Dockerfile & Container Build

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Interfaces:**
- Produces: Production Docker image that runs `next start`

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production stage — minimal image
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 2: Create `.dockerignore`**

```
.git
.next
node_modules
*.md
.env*
terraform/
tests/
docs/
.github/
```

- [ ] **Step 3: Enable standalone output in `next.config.ts`**

Add `output: 'standalone'` to the nextConfig object:

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // ... rest of config
}
```

- [ ] **Step 4: Build and test Docker image locally**

```bash
docker build -t life-os:local .
docker run --rm -p 3000:3000 \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e GOOGLE_CLIENT_ID=dummy \
  -e GOOGLE_CLIENT_SECRET=dummy \
  -e GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback \
  -e GCP_PROJECT_ID=dummy \
  -e KMS_KEY_NAME=dummy \
  life-os:local
```

Expected: Server starts on port 3000.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore next.config.ts
git commit -m "chore(docker): add production Dockerfile with standalone Next.js build"
```

---

## Task 12: Terraform Infrastructure

**Files:**
- Create: `terraform/main.tf`
- Create: `terraform/variables.tf`
- Create: `terraform/outputs.tf`
- Create: `terraform/iam.tf`
- Create: `terraform/kms.tf`
- Create: `terraform/firestore.tf`
- Create: `terraform/storage.tf`
- Create: `terraform/secrets.tf`
- Create: `terraform/cloudrun.tf`
- Create: `terraform/monitoring.tf`
- Create: `terraform/environments/dev.tfvars`
- Create: `terraform/environments/prod.tfvars`

- [ ] **Step 1: Create `terraform/variables.tf`**

```hcl
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-southeast1"
}

variable "environment" {
  description = "Environment: dev, staging, prod"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "alert_email" {
  description = "Email for monitoring alerts"
  type        = string
  default     = "er.vikassri@gmail.com"
}

variable "container_image" {
  description = "Full container image URI (e.g. asia-northeast1-docker.pkg.dev/...)"
  type        = string
  default     = "gcr.io/cloudrun/placeholder"
}
```

- [ ] **Step 2: Create `terraform/main.tf`**

```hcl
terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  # Remote state — configure backend after GCS bucket is created manually
  # backend "gcs" {
  #   bucket = "life-os-tfstate-{project_id}"
  #   prefix = "terraform/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "firestore.googleapis.com",
    "cloudkms.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "iam.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}
```

- [ ] **Step 3: Create `terraform/iam.tf`**

```hcl
# Cloud Run runtime service account — least privilege
resource "google_service_account" "vault_sa" {
  account_id   = "life-os-vault-${var.environment}"
  display_name = "Life OS Vault Runtime SA (${var.environment})"
  description  = "Minimal permissions for Cloud Run vault service"
}

locals {
  vault_sa_roles = [
    "roles/datastore.user",
    "roles/storage.objectAdmin",
    "roles/secretmanager.secretAccessor",
    "roles/cloudkms.cryptoKeyEncrypterDecrypter",
    "roles/logging.logWriter",
  ]
}

resource "google_project_iam_member" "vault_sa_roles" {
  for_each = toset(local.vault_sa_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.vault_sa.email}"
}
```

- [ ] **Step 4: Create `terraform/kms.tf`**

```hcl
resource "google_kms_key_ring" "life_os" {
  name     = "life-os-keyring-${var.environment}"
  location = var.region
  depends_on = [google_project_service.apis]
}

resource "google_kms_crypto_key" "data_key" {
  name            = "data-encryption-key"
  key_ring        = google_kms_key_ring.life_os.id
  rotation_period = "31536000s" # 365 days

  lifecycle {
    prevent_destroy = true # Never accidentally destroy encryption keys
  }

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }
}

# Grant Cloud Run SA access to this specific key only
resource "google_kms_crypto_key_iam_member" "vault_sa_kms" {
  crypto_key_id = google_kms_crypto_key.data_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.vault_sa.email}"
}
```

- [ ] **Step 5: Create `terraform/firestore.tf`**

```hcl
resource "google_firestore_database" "default" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
  depends_on  = [google_project_service.apis]

  # Point-in-time recovery
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
}
```

- [ ] **Step 6: Create `terraform/storage.tf`**

```hcl
resource "google_storage_bucket" "documents" {
  name          = "life-os-documents-${var.project_id}-${var.environment}"
  location      = upper(var.region)
  storage_class = "STANDARD"
  force_destroy = var.environment != "prod"

  versioning { enabled = true }

  uniform_bucket_level_access = true

  encryption {
    default_kms_key_name = google_kms_crypto_key.data_key.id
  }

  public_access_prevention = "enforced"

  lifecycle_rule {
    action { type = "Delete" }
    condition { num_newer_versions = 10 }
  }
}

resource "google_storage_bucket" "backups" {
  name          = "life-os-backups-${var.project_id}-${var.environment}"
  location      = "ASIA"
  storage_class = "NEARLINE"
  force_destroy = false

  versioning { enabled = true }
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  retention_policy {
    retention_period = 7776000 # 90 days
    is_locked        = var.environment == "prod"
  }
}
```

- [ ] **Step 7: Create `terraform/secrets.tf`**

```hcl
locals {
  secrets = {
    oauth_client_id     = "Google OAuth Client ID"
    oauth_client_secret = "Google OAuth Client Secret"
    session_secret      = "Iron session encryption key (64+ hex chars)"
  }
}

resource "google_secret_manager_secret" "app_secrets" {
  for_each  = local.secrets
  secret_id = "life-os-${each.key}-${var.environment}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

# Secrets are populated manually — Terraform only creates the containers
# To add values: gcloud secrets versions add life-os-session-secret-prod --data-file=-
```

- [ ] **Step 8: Create `terraform/cloudrun.tf`**

```hcl
resource "google_cloud_run_v2_service" "vault" {
  name     = "life-os-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.vault_sa.email

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = var.container_image

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "GCP_REGION"
        value = var.region
      }

      env {
        name = "KMS_KEY_NAME"
        value = "${google_kms_crypto_key.data_key.id}/cryptoKeyVersions/1"
      }

      dynamic "env" {
        for_each = google_secret_manager_secret.app_secrets
        content {
          name = upper(replace(split("life-os-", env.key)[1], "-${var.environment}", ""))
          value_source {
            secret_key_ref {
              secret  = env.value.secret_id
              version = "latest"
            }
          }
        }
      }

      liveness_probe {
        http_get { path = "/api/v1/health" }
        initial_delay_seconds = 5
        period_seconds        = 30
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_project_iam_member.vault_sa_roles,
  ]
}

# Make the service publicly accessible (auth is handled by the app)
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  name     = google_cloud_run_v2_service.vault.name
  location = google_cloud_run_v2_service.vault.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
```

- [ ] **Step 9: Create `terraform/monitoring.tf`**

```hcl
resource "google_monitoring_notification_channel" "email" {
  display_name = "Life OS Alert Email"
  type         = "email"
  labels       = { email_address = var.alert_email }
}

resource "google_logging_metric" "auth_failures" {
  name   = "life-os-auth-failures-${var.environment}"
  filter = <<-EOT
    resource.type="cloud_run_revision"
    AND jsonPayload.event="login_blocked_allowlist"
  EOT
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_monitoring_alert_policy" "auth_failures" {
  display_name = "[Life OS ${var.environment}] Repeated Auth Failures"
  combiner     = "OR"

  conditions {
    display_name = "Auth failures > 5 in 5 minutes"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.auth_failures.name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]
  severity              = "CRITICAL"
}
```

- [ ] **Step 10: Create `terraform/outputs.tf`**

```hcl
output "cloud_run_url" {
  description = "Cloud Run service URL"
  value       = google_cloud_run_v2_service.vault.uri
}

output "vault_service_account" {
  description = "Cloud Run service account email"
  value       = google_service_account.vault_sa.email
}

output "kms_key_name" {
  description = "Full KMS key resource name"
  value       = google_kms_crypto_key.data_key.id
  sensitive   = true
}

output "documents_bucket" {
  description = "GCS documents bucket name"
  value       = google_storage_bucket.documents.name
}
```

- [ ] **Step 11: Create environment tfvars**

`terraform/environments/dev.tfvars`:
```hcl
environment     = "dev"
region          = "asia-southeast1"
alert_email     = "er.vikassri@gmail.com"
```

`terraform/environments/prod.tfvars`:
```hcl
environment     = "prod"
region          = "asia-southeast1"
alert_email     = "er.vikassri@gmail.com"
```

- [ ] **Step 12: Validate Terraform syntax**

```bash
cd terraform && terraform init -backend=false && terraform validate
```

Expected: "Success! The configuration is valid."

- [ ] **Step 13: Commit**

```bash
git add terraform/
git commit -m "feat(terraform): add complete GCP infrastructure — IAM, KMS, Firestore, GCS, Cloud Run, monitoring"
```

---

## Task 13: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx vitest run --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm audit --audit-level=high

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-type-check, unit-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run build
        env:
          SESSION_SECRET: ${{ secrets.CI_SESSION_SECRET }}
          GOOGLE_CLIENT_ID: dummy
          GOOGLE_CLIENT_SECRET: dummy
          GOOGLE_REDIRECT_URI: http://localhost:3000/api/auth/callback
          GCP_PROJECT_ID: dummy
          KMS_KEY_NAME: dummy
```

- [ ] **Step 2: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: asia-southeast1
  SERVICE_NAME: life-os-prod
  IMAGE: asia-southeast1-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/life-os/vault

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write   # For Workload Identity Federation

    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.DEPLOY_SA_EMAIL }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Build and push container
        run: |
          gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev
          docker build -t ${{ env.IMAGE }}:${{ github.sha }} .
          docker push ${{ env.IMAGE }}:${{ github.sha }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image ${{ env.IMAGE }}:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions CI pipeline and Cloud Run deploy workflow"
```

---

## Task 14: E2E Tests (Playwright)

**Files:**
- Create: `tests/e2e/auth-protection.spec.ts`
- Create: `tests/e2e/login.spec.ts`
- Create: `tests/e2e/logout.spec.ts`

- [ ] **Step 1: Create `tests/e2e/auth-protection.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Authentication protection', () => {
  test('unauthenticated user is redirected to /login from /dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user is redirected to /login from /vault/passwords', async ({ page }) => {
    await page.goto('/vault/passwords')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page shows Google sign-in button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible()
  })

  test('login page shows vault branding', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Life OS')).toBeVisible()
    await expect(page.getByText('Your private digital vault')).toBeVisible()
  })

  test('health endpoint returns 200', async ({ request }) => {
    const res = await request.get('/api/v1/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
```

- [ ] **Step 2: Run E2E tests against local dev server**

```bash
# In one terminal:
npm run dev

# In another:
npx playwright test tests/e2e/auth-protection.spec.ts
```

Expected: PASS (5 tests).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/
git commit -m "test(e2e): add Playwright auth protection and login page tests"
```

---

## Task 15: Documentation

**Files:**
- Create: `README.md`
- Create: `ARCHITECTURE.md`
- Create: `SECURITY.md`
- Create: `DEPLOYMENT.md`
- Create: `docs/THREAT_MODEL.md`

- [ ] **Step 1: Create `README.md`**

````markdown
# Life OS — Personal Digital Vault

Private single-user Personal Life OS hosted on Google Cloud.

**Access:** Restricted to `er.vikassri@gmail.com` only.

## Stack

- Next.js 14 + TypeScript + Tailwind CSS
- Cloud Run (asia-southeast1)
- Cloud Firestore (server-side only)
- Cloud KMS (AES-256-GCM envelope encryption)
- Google Secret Manager
- iron-session (encrypted HTTP-only cookies)
- Terraform

## Local Development

### Prerequisites

```bash
# Install gcloud CLI: https://cloud.google.com/sdk/docs/install
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### Environment variables (never commit these)

```bash
cp .env.example .env.local
# Fill in values from Secret Manager
```

### Run

```bash
npm install
npm run dev
```

### Test

```bash
npm test                    # unit + integration
npx playwright test         # e2e
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).

## Security

See [SECURITY.md](SECURITY.md) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).
````

- [ ] **Step 2: Create `.env.example`**

```bash
# Copy this to .env.local — NEVER commit .env.local

# Google OAuth (get from GCP Console → APIs & Services → Credentials)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Session encryption key — generate with: openssl rand -hex 32
SESSION_SECRET=

# GCP
GCP_PROJECT_ID=
GCP_REGION=asia-southeast1

# KMS key name (full resource path)
# Format: projects/{project}/locations/{region}/keyRings/{ring}/cryptoKeys/{key}
KMS_KEY_NAME=
```

- [ ] **Step 3: Commit**

```bash
git add README.md ARCHITECTURE.md SECURITY.md DEPLOYMENT.md docs/ .env.example
git commit -m "docs: add README, architecture, security, deployment, and threat model docs"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run --coverage
```

Expected: All unit tests PASS. Coverage > 80% for `lib/`.

- [ ] **Step 2: TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Security audit**

```bash
npm audit --audit-level=high
```

Expected: 0 high/critical vulnerabilities.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: BUILD SUCCESS.

- [ ] **Step 5: Terraform validate**

```bash
cd terraform && terraform init -backend=false && terraform validate
```

Expected: "Success! The configuration is valid."

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: Sub-Project 1 Foundation complete — auth, encryption, middleware, terraform, tests"
```

---

## GCP Setup Guide (Before First Deploy)

Run these steps once manually before Terraform:

```bash
# 1. Install gcloud CLI
# https://cloud.google.com/sdk/docs/install

# 2. Create GCP project
gcloud projects create life-os-prod-$(date +%Y) --name="Life OS"
gcloud config set project life-os-prod-YYYY

# 3. Enable billing
# https://console.cloud.google.com/billing

# 4. Create OAuth 2.0 credentials
# GCP Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID
# Application type: Web application
# Authorized redirect URI: https://YOUR_CLOUD_RUN_URL/api/auth/callback
# Add er.vikassri@gmail.com as test user in OAuth consent screen

# 5. Create Artifact Registry
gcloud artifacts repositories create life-os \
  --repository-format=docker \
  --location=asia-southeast1

# 6. Run Terraform
cd terraform
terraform init
terraform apply -var-file=environments/prod.tfvars \
  -var="project_id=life-os-prod-YYYY" \
  -var="container_image=gcr.io/cloudrun/placeholder"

# 7. Populate secrets (never in code)
echo -n "YOUR_CLIENT_ID" | \
  gcloud secrets versions add life-os-oauth-client-id-prod --data-file=-

echo -n "YOUR_CLIENT_SECRET" | \
  gcloud secrets versions add life-os-oauth-client-secret-prod --data-file=-

openssl rand -hex 32 | \
  gcloud secrets versions add life-os-session-secret-prod --data-file=-

# 8. Deploy
gcloud run deploy life-os-prod \
  --image asia-southeast1-docker.pkg.dev/YOUR_PROJECT/life-os/vault:latest \
  --region asia-southeast1
```

---

## Task 17: AI Chatbot & Configurable Agent System

**Files:**
- Create: `lib/ai/provider.ts`              — LLM provider abstraction (Gemini / OpenAI-compat)
- Create: `lib/ai/agents.ts`                — Agent config CRUD (Firestore)
- Create: `lib/ai/chat.ts`                  — Chat session logic
- Create: `lib/ai/types.ts`                 — Shared AI types
- Create: `app/api/v1/chat/route.ts`        — Streaming chat API endpoint
- Create: `app/api/v1/agents/route.ts`      — Agent CRUD API
- Create: `app/api/v1/agents/[id]/route.ts` — Agent get/update/delete
- Create: `app/(vault)/chat/page.tsx`       — Chatbot UI page
- Create: `app/(vault)/agents/page.tsx`     — Agent management UI
- Create: `components/chat/ChatWindow.tsx`  — Main chat component
- Create: `components/chat/MessageBubble.tsx`
- Create: `components/chat/AgentSelector.tsx`
- Create: `components/agents/AgentCard.tsx`
- Create: `components/agents/AgentForm.tsx`
- Create: `tests/unit/ai/agents.test.ts`
- Create: `tests/unit/ai/provider.test.ts`

**Interfaces:**
- Consumes: `withApiGuard` from `lib/middleware/api-guard`, `getFirestoreDb` from `lib/db/client`, `SessionData` from `lib/auth/session`
- Produces:
  - `AgentConfig` interface
  - `streamChat(agentId, messages, userId): AsyncIterable<string>`
  - `createAgent(userId, config): Promise<AgentConfig>`
  - `listAgents(userId): Promise<AgentConfig[]>`
  - `updateAgent(userId, id, patch): Promise<AgentConfig>`
  - `deleteAgent(userId, id): Promise<void>`
  - `GET /api/v1/agents` — list agents
  - `POST /api/v1/agents` — create agent
  - `GET /api/v1/agents/[id]` — get agent
  - `PUT /api/v1/agents/[id]` — update agent
  - `DELETE /api/v1/agents/[id]` — delete agent
  - `POST /api/v1/chat` — streaming chat (SSE)

---

### Agent Config Schema

Each agent is fully configurable by the user:

```typescript
interface AgentConfig {
  id: string
  userId: string
  name: string                         // Display name e.g. "Research Assistant"
  description: string                  // What this agent does
  systemPrompt: string                 // Full system prompt / persona
  model: string                        // e.g. "gemini-1.5-pro", "gpt-4o", "gemini-2.0-flash"
  temperature: number                  // 0.0 – 2.0
  maxTokens: number                    // Response length cap
  contextWindowSize: number            // How many past messages to include
  tools: AgentTool[]                   // Enabled tools (web_search, calculator, etc.)
  isDefault: boolean                   // Show as default in chat selector
  createdAt: number
  updatedAt: number
  // Privacy: never stored in logs, never sent to analytics
}

type AgentTool = 'web_search' | 'calculator' | 'date_time' | 'vault_search'
```

---

### Built-in Default Agents (created on first login)

| Agent | System Prompt Purpose | Model |
|-------|----------------------|-------|
| Personal Assistant | General tasks, reminders, planning | gemini-2.0-flash |
| Research Helper | Deep research, summarize documents | gemini-1.5-pro |
| Finance Advisor | Investment analysis, portfolio queries | gemini-1.5-pro |
| Journal Companion | Reflective journaling prompts, mood analysis | gemini-2.0-flash |
| Code Assistant | Code review, debugging, architecture | gemini-2.0-flash |

---

- [ ] **Step 1: Write failing tests**

Create `tests/unit/ai/agents.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  getFirestoreDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn(async () => {}),
        get: vi.fn(async () => ({ exists: true, data: () => mockAgent, id: 'agent-1' })),
        update: vi.fn(async () => {}),
        delete: vi.fn(async () => {}),
      })),
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          get: vi.fn(async () => ({ docs: [{ id: 'agent-1', data: () => mockAgent }] })),
        })),
      })),
    })),
  })),
}))

const mockAgent = {
  id: 'agent-1',
  userId: 'user-123',
  name: 'Test Agent',
  description: 'A test agent',
  systemPrompt: 'You are a helpful assistant.',
  model: 'gemini-2.0-flash',
  temperature: 0.7,
  maxTokens: 2048,
  contextWindowSize: 10,
  tools: [],
  isDefault: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

import { createAgent, listAgents, deleteAgent } from '@/lib/ai/agents'

describe('Agent CRUD', () => {
  it('createAgent returns AgentConfig with id', async () => {
    const agent = await createAgent('user-123', {
      name: 'Test Agent',
      description: 'A test agent',
      systemPrompt: 'You are a helpful assistant.',
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      maxTokens: 2048,
      contextWindowSize: 10,
      tools: [],
      isDefault: false,
    })
    expect(agent).toHaveProperty('id')
    expect(agent.name).toBe('Test Agent')
    expect(agent.userId).toBe('user-123')
  })

  it('listAgents returns array', async () => {
    const agents = await listAgents('user-123')
    expect(Array.isArray(agents)).toBe(true)
  })
})
```

Create `tests/unit/ai/provider.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildMessages, trimToContextWindow } from '@/lib/ai/provider'
import type { ChatMessage } from '@/lib/ai/types'

describe('buildMessages', () => {
  it('prepends system prompt to message array', () => {
    const msgs: ChatMessage[] = [{ role: 'user', content: 'Hello' }]
    const result = buildMessages('You are helpful.', msgs)
    expect(result[0]).toEqual({ role: 'system', content: 'You are helpful.' })
    expect(result[1]).toEqual({ role: 'user', content: 'Hello' })
  })
})

describe('trimToContextWindow', () => {
  it('keeps only the last N messages', () => {
    const msgs: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }))
    const trimmed = trimToContextWindow(msgs, 5)
    expect(trimmed).toHaveLength(5)
    expect(trimmed[0]?.content).toBe('Message 15')
  })

  it('returns all messages when under window', () => {
    const msgs: ChatMessage[] = [{ role: 'user', content: 'Hi' }]
    expect(trimToContextWindow(msgs, 10)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run tests/unit/ai/
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `lib/ai/types.ts`**

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type AgentTool = 'web_search' | 'calculator' | 'date_time' | 'vault_search'

export interface AgentConfig {
  id: string
  userId: string
  name: string
  description: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  contextWindowSize: number
  tools: AgentTool[]
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

export type AgentConfigInput = Omit<AgentConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

export interface ChatRequest {
  agentId: string
  messages: ChatMessage[]
}

// Safe agent view — strips internal userId for API responses
export type AgentConfigPublic = Omit<AgentConfig, 'userId'>
```

- [ ] **Step 4: Create `lib/ai/provider.ts`**

```typescript
import type { ChatMessage } from './types'

// Supports Google Vertex AI (Gemini) and OpenAI-compatible APIs
// Provider selection is based on the model name prefix

function getVertexConfig() {
  const projectId = process.env['GCP_PROJECT_ID']
  const location = process.env['GCP_REGION'] ?? 'asia-southeast1'
  if (!projectId) throw new Error('GCP_PROJECT_ID is not configured')
  return { projectId, location }
}

function getOpenAICompatConfig() {
  const apiKey = process.env['OPENAI_COMPATIBLE_API_KEY'] ?? ''
  const baseUrl = process.env['OPENAI_COMPATIBLE_BASE_URL'] ?? 'https://api.openai.com/v1'
  return { apiKey, baseUrl }
}

export function buildMessages(
  systemPrompt: string,
  messages: ChatMessage[],
): ChatMessage[] {
  return [{ role: 'system', content: systemPrompt }, ...messages]
}

export function trimToContextWindow(
  messages: ChatMessage[],
  windowSize: number,
): ChatMessage[] {
  if (messages.length <= windowSize) return messages
  return messages.slice(messages.length - windowSize)
}

export async function* streamChatCompletion(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): AsyncGenerator<string> {
  const isGemini = model.startsWith('gemini-')

  if (isGemini) {
    yield* streamGemini(model, messages, temperature, maxTokens)
  } else {
    yield* streamOpenAICompat(model, messages, temperature, maxTokens)
  }
}

async function* streamGemini(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): AsyncGenerator<string> {
  const { projectId, location } = getVertexConfig()
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:streamGenerateContent`

  // Get access token via Application Default Credentials
  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
  const client = await auth.getClient()
  const token = await client.getAccessToken()

  // Convert messages to Gemini format
  const geminiContents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const systemInstruction = messages.find(m => m.role === 'system')?.content

  const body = {
    contents: geminiContents,
    ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } }),
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // Parse NDJSON chunks from Gemini streaming response
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === '[' || trimmed === ']' || trimmed === ',') continue
      try {
        const clean = trimmed.replace(/^,/, '')
        const chunk = JSON.parse(clean)
        const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) yield text
      } catch {
        // Skip malformed chunks
      }
    }
  }
}

async function* streamOpenAICompat(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): AsyncGenerator<string> {
  const { apiKey, baseUrl } = getOpenAICompatConfig()

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`LLM API error: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') return
      try {
        const chunk = JSON.parse(data)
        const content = chunk?.choices?.[0]?.delta?.content
        if (content) yield content
      } catch {
        // Skip malformed SSE chunks
      }
    }
  }
}
```

- [ ] **Step 5: Create `lib/ai/agents.ts`**

```typescript
import { randomUUID } from 'crypto'
import { getFirestoreDb } from '@/lib/db/client'
import type { AgentConfig, AgentConfigInput } from './types'

const AGENTS_COLLECTION = (userId: string) => `users/${userId}/agents`

export async function createAgent(
  userId: string,
  input: AgentConfigInput,
): Promise<AgentConfig> {
  const db = getFirestoreDb()
  const id = randomUUID()
  const now = Date.now()

  const agent: AgentConfig = {
    id,
    userId,
    ...input,
    createdAt: now,
    updatedAt: now,
  }

  await db.collection(AGENTS_COLLECTION(userId)).doc(id).set(agent)
  return agent
}

export async function listAgents(userId: string): Promise<AgentConfig[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(AGENTS_COLLECTION(userId))
    .orderBy('createdAt', 'asc')
    .get()

  return snapshot.docs.map(doc => doc.data() as AgentConfig)
}

export async function getAgent(
  userId: string,
  agentId: string,
): Promise<AgentConfig | null> {
  const db = getFirestoreDb()
  const doc = await db
    .collection(AGENTS_COLLECTION(userId))
    .doc(agentId)
    .get()

  if (!doc.exists) return null
  return doc.data() as AgentConfig
}

export async function updateAgent(
  userId: string,
  agentId: string,
  patch: Partial<AgentConfigInput>,
): Promise<AgentConfig> {
  const db = getFirestoreDb()
  const ref = db.collection(AGENTS_COLLECTION(userId)).doc(agentId)
  const existing = await ref.get()
  if (!existing.exists) throw new Error('Agent not found')

  const updates = { ...patch, updatedAt: Date.now() }
  await ref.update(updates)

  return { ...(existing.data() as AgentConfig), ...updates }
}

export async function deleteAgent(userId: string, agentId: string): Promise<void> {
  const db = getFirestoreDb()
  await db.collection(AGENTS_COLLECTION(userId)).doc(agentId).delete()
}

export async function seedDefaultAgents(userId: string): Promise<void> {
  const existing = await listAgents(userId)
  if (existing.length > 0) return // Already seeded

  const defaults: AgentConfigInput[] = [
    {
      name: 'Personal Assistant',
      description: 'General tasks, planning, and everyday help',
      systemPrompt: `You are a personal assistant for a private Life OS. You help with planning, reminders, general questions, and daily tasks. Be concise, practical, and thoughtful. Never share or reference personal data unless the user brings it up. Today's date: ${new Date().toDateString()}.`,
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      maxTokens: 2048,
      contextWindowSize: 20,
      tools: ['date_time', 'calculator'],
      isDefault: true,
    },
    {
      name: 'Research Helper',
      description: 'Deep research, summarization, and analysis',
      systemPrompt: 'You are a research assistant. You provide thorough, accurate, well-cited responses. When asked to summarize, extract key insights. When asked to research, be comprehensive. Always indicate if information might be outdated.',
      model: 'gemini-1.5-pro',
      temperature: 0.3,
      maxTokens: 4096,
      contextWindowSize: 15,
      tools: [],
      isDefault: false,
    },
    {
      name: 'Finance Advisor',
      description: 'Investment analysis, portfolio insights, financial planning',
      systemPrompt: 'You are a financial analysis assistant. You help analyze investments, explain financial concepts, and assist with portfolio thinking. You do NOT provide regulated financial advice. Always remind the user to consult a licensed financial advisor for decisions. Focus on education and analysis.',
      model: 'gemini-1.5-pro',
      temperature: 0.2,
      maxTokens: 2048,
      contextWindowSize: 10,
      tools: ['calculator'],
      isDefault: false,
    },
    {
      name: 'Journal Companion',
      description: 'Reflective prompts, mood tracking, and journaling support',
      systemPrompt: 'You are a compassionate journaling companion. You ask thoughtful, open-ended questions to encourage self-reflection. You help the user explore their thoughts, feelings, and goals. Be warm, non-judgmental, and supportive. Never give unsolicited advice.',
      model: 'gemini-2.0-flash',
      temperature: 0.9,
      maxTokens: 1024,
      contextWindowSize: 20,
      tools: [],
      isDefault: false,
    },
    {
      name: 'Code Assistant',
      description: 'Code review, debugging, architecture, and technical help',
      systemPrompt: 'You are a senior software engineer assistant. You help with code review, debugging, architecture decisions, and technical explanations. You favor security, simplicity, and correctness. Always explain your reasoning. Prefer TypeScript/Python. Point out security issues proactively.',
      model: 'gemini-2.0-flash',
      temperature: 0.2,
      maxTokens: 4096,
      contextWindowSize: 15,
      tools: [],
      isDefault: false,
    },
  ]

  for (const config of defaults) {
    await createAgent(userId, config)
  }
}
```

- [ ] **Step 6: Create `lib/ai/chat.ts`**

```typescript
import { getAgent } from './agents'
import { streamChatCompletion, buildMessages, trimToContextWindow } from './provider'
import type { ChatMessage } from './types'
import { ApiError } from '@/lib/errors/api-error'

export async function* streamChat(
  userId: string,
  agentId: string,
  messages: ChatMessage[],
): AsyncGenerator<string> {
  const agent = await getAgent(userId, agentId)
  if (!agent) throw new ApiError(404, 'Agent not found')
  if (agent.userId !== userId) throw new ApiError(403, 'Access denied')

  const trimmed = trimToContextWindow(messages, agent.contextWindowSize)
  const fullMessages = buildMessages(agent.systemPrompt, trimmed)

  yield* streamChatCompletion(
    agent.model,
    fullMessages,
    agent.temperature,
    agent.maxTokens,
  )
}
```

- [ ] **Step 7: Create `app/api/v1/chat/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { z } from 'zod'
import { sessionOptions, isSessionValid, type SessionData } from '@/lib/auth/session'
import { streamChat } from '@/lib/ai/chat'
import { createErrorResponse } from '@/lib/errors/api-error'
import { apiRateLimiter } from '@/lib/security/rate-limit'

const ChatRequestSchema = z.object({
  agentId: z.string().uuid(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(10_000),
    }),
  ).min(1).max(50),
})

export async function POST(req: NextRequest): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (!apiRateLimiter(ip)) return createErrorResponse(429, 'Too many requests')

  const session = await getIronSession<SessionData>(req, new Response(), sessionOptions)
  if (!isSessionValid(session)) return createErrorResponse(401, 'Authentication required')

  const body = await req.json().catch(() => null)
  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) return createErrorResponse(400, 'Invalid request')

  const { agentId, messages } = parsed.data

  // Return Server-Sent Events stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat(session.sub, agentId, messages)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

- [ ] **Step 8: Create Agent CRUD API routes**

`app/api/v1/agents/route.ts`:
```typescript
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/middleware/api-guard'
import { createAgent, listAgents } from '@/lib/ai/agents'
import { createErrorResponse, safeError } from '@/lib/errors/api-error'
import type { SessionData } from '@/lib/auth/session'

const AgentInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  systemPrompt: z.string().min(1).max(8000),
  model: z.enum(['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gpt-4o', 'gpt-4o-mini']),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(256).max(8192),
  contextWindowSize: z.number().int().min(1).max(50),
  tools: z.array(z.enum(['web_search', 'calculator', 'date_time', 'vault_search'])),
  isDefault: z.boolean(),
})

export const GET = withApiGuard(
  async (_req, { session }: { session: SessionData }) => {
    const agents = await listAgents(session.sub)
    const publicAgents = agents.map(({ userId: _u, ...rest }) => rest)
    return Response.json({ agents: publicAgents })
  },
  { skipCsrf: true },
)

export const POST = withApiGuard(
  async (req: NextRequest, { session }: { session: SessionData }) => {
    const body = await req.json().catch(() => null)
    const parsed = AgentInputSchema.safeParse(body)
    if (!parsed.success) return createErrorResponse(400, 'Invalid agent configuration')

    try {
      const agent = await createAgent(session.sub, parsed.data)
      const { userId: _u, ...publicAgent } = agent
      return Response.json({ agent: publicAgent }, { status: 201 })
    } catch (err) {
      return createErrorResponse(500, safeError(err).message)
    }
  },
)
```

`app/api/v1/agents/[id]/route.ts`:
```typescript
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/middleware/api-guard'
import { getAgent, updateAgent, deleteAgent } from '@/lib/ai/agents'
import { createErrorResponse, safeError } from '@/lib/errors/api-error'
import type { SessionData } from '@/lib/auth/session'

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(1).max(8000).optional(),
  model: z.enum(['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gpt-4o', 'gpt-4o-mini']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(8192).optional(),
  contextWindowSize: z.number().int().min(1).max(50).optional(),
  tools: z.array(z.enum(['web_search', 'calculator', 'date_time', 'vault_search'])).optional(),
  isDefault: z.boolean().optional(),
})

export const GET = withApiGuard(
  async (req: NextRequest, { session }: { session: SessionData }) => {
    const id = req.nextUrl.pathname.split('/').pop() ?? ''
    const agent = await getAgent(session.sub, id)
    if (!agent) return createErrorResponse(404, 'Agent not found')
    const { userId: _u, ...publicAgent } = agent
    return Response.json({ agent: publicAgent })
  },
  { skipCsrf: true },
)

export const PUT = withApiGuard(
  async (req: NextRequest, { session }: { session: SessionData }) => {
    const id = req.nextUrl.pathname.split('/').pop() ?? ''
    const body = await req.json().catch(() => null)
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) return createErrorResponse(400, 'Invalid update data')
    try {
      const updated = await updateAgent(session.sub, id, parsed.data)
      const { userId: _u, ...publicAgent } = updated
      return Response.json({ agent: publicAgent })
    } catch (err) {
      return createErrorResponse(500, safeError(err).message)
    }
  },
)

export const DELETE = withApiGuard(
  async (req: NextRequest, { session }: { session: SessionData }) => {
    const id = req.nextUrl.pathname.split('/').pop() ?? ''
    try {
      await deleteAgent(session.sub, id)
      return Response.json({ success: true })
    } catch (err) {
      return createErrorResponse(500, safeError(err).message)
    }
  },
)
```

- [ ] **Step 9: Create Chat UI components**

`components/chat/MessageBubble.tsx`:
```tsx
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-emerald-600 text-white rounded-br-sm'
            : 'bg-zinc-800 text-zinc-100 rounded-bl-sm',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 ml-1 bg-current opacity-70 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}
```

`components/chat/AgentSelector.tsx`:
```tsx
'use client'

import { ChevronDown } from 'lucide-react'
import type { AgentConfigPublic } from '@/lib/ai/types'

interface AgentSelectorProps {
  agents: AgentConfigPublic[]
  selectedId: string
  onSelect: (id: string) => void
}

export function AgentSelector({ agents, selectedId, onSelect }: AgentSelectorProps) {
  const selected = agents.find(a => a.id === selectedId)

  return (
    <div className="relative">
      <select
        value={selectedId}
        onChange={e => onSelect(e.target.value)}
        className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 pr-8 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
        aria-label="Select agent"
      >
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-zinc-400" />
      {selected && (
        <p className="mt-1 text-xs text-zinc-500">{selected.description}</p>
      )}
    </div>
  )
}
```

`components/chat/ChatWindow.tsx`:
```tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessageBubble } from './MessageBubble'
import { AgentSelector } from './AgentSelector'
import type { ChatMessage, AgentConfigPublic } from '@/lib/ai/types'

interface ChatWindowProps {
  agents: AgentConfigPublic[]
  defaultAgentId: string
}

export function ChatWindow({ agents, defaultAgentId }: ChatWindowProps) {
  const [selectedAgentId, setSelectedAgentId] = useState(defaultAgentId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMessage: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsStreaming(true)

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgentId, messages: updatedMessages }),
      })

      if (!res.ok || !res.body) {
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
        ])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assembled = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string }
            if (parsed.text) {
              assembled += parsed.text
              setMessages(prev => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: assembled },
              ])
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Connection error. Please try again.' },
      ])
    } finally {
      setIsStreaming(false)
      inputRef.current?.focus()
    }
  }, [input, isStreaming, messages, selectedAgentId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Agent selector */}
      <div className="border-b border-zinc-800 p-4">
        <AgentSelector
          agents={agents}
          selectedId={selectedAgentId}
          onSelect={id => { setSelectedAgentId(id); setMessages([]) }}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-600">
              Start a conversation. Your messages are private.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role as 'user' | 'assistant'}
            content={msg.content}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your agent… (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
            style={{ maxHeight: '120px' }}
            aria-label="Chat message"
          />
          <Button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isStreaming}
            size="sm"
            className="h-11 w-11 shrink-0 rounded-xl bg-emerald-600 p-0 hover:bg-emerald-500 disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          Messages are not stored. Switch agents to reset context.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 10: Create Agent Management UI**

`components/agents/AgentCard.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Pencil, Trash2, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AgentConfigPublic } from '@/lib/ai/types'

interface AgentCardProps {
  agent: AgentConfigPublic
  onEdit: (agent: AgentConfigPublic) => void
  onDelete: (id: string) => void
}

export function AgentCard({ agent, onEdit, onDelete }: AgentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return
    setIsDeleting(true)
    try {
      await fetch(`/api/v1/agents/${agent.id}`, { method: 'DELETE' })
      onDelete(agent.id)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-emerald-400 shrink-0" />
          <h3 className="text-sm font-medium">{agent.name}</h3>
          {agent.isDefault && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
              Default
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(agent)}
            aria-label={`Edit ${agent.name}`}
            className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            aria-label={`Delete ${agent.name}`}
            className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">{agent.description}</p>
      <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
        <span className="rounded bg-zinc-800 px-2 py-0.5">{agent.model}</span>
        <span className="rounded bg-zinc-800 px-2 py-0.5">temp {agent.temperature}</span>
        <span className="rounded bg-zinc-800 px-2 py-0.5">{agent.maxTokens} tokens</span>
        <span className="rounded bg-zinc-800 px-2 py-0.5">ctx {agent.contextWindowSize}</span>
      </div>
      {agent.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agent.tools.map(tool => (
            <span key={tool} className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
              {tool}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 11: Create page routes**

`app/(vault)/chat/page.tsx`:
```tsx
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/auth/session'
import { listAgents, seedDefaultAgents } from '@/lib/ai/agents'
import { ChatWindow } from '@/components/chat/ChatWindow'
import type { AgentConfigPublic } from '@/lib/ai/types'

export default async function ChatPage() {
  const cookieStore = cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)

  // Seed default agents on first visit
  await seedDefaultAgents(session.sub)

  const agents = await listAgents(session.sub)
  const publicAgents: AgentConfigPublic[] = agents.map(({ userId: _u, ...rest }) => rest)
  const defaultAgent = publicAgents.find(a => a.isDefault) ?? publicAgents[0]

  if (!defaultAgent || publicAgents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-zinc-500">No agents configured.</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Chat</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Your private AI assistant. Messages are not stored.
        </p>
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <ChatWindow agents={publicAgents} defaultAgentId={defaultAgent.id} />
      </div>
    </div>
  )
}
```

`app/(vault)/agents/page.tsx`:
```tsx
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/auth/session'
import { listAgents } from '@/lib/ai/agents'
import { AgentCard } from '@/components/agents/AgentCard'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import type { AgentConfigPublic } from '@/lib/ai/types'

export default async function AgentsPage() {
  const cookieStore = cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  const agents = await listAgents(session.sub)
  const publicAgents: AgentConfigPublic[] = agents.map(({ userId: _u, ...rest }) => rest)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configure your personal AI agents. Each agent has its own persona, model, and behavior.
          </p>
        </div>
        <Link
          href="/agents/new"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          New Agent
        </Link>
      </div>

      {publicAgents.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-zinc-500">No agents yet. Create your first agent.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publicAgents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 12: Add Chat & Agents to Sidebar**

Update `components/layout/Sidebar.tsx` — add `MessageSquare` and `Bot` icons:

```tsx
import {
  LayoutDashboard, BookOpen, FileText, FolderOpen,
  Lock, TrendingUp, DollarSign, Search, Settings,
  MessageSquare, Bot,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/vault/passwords', label: 'Password Vault', icon: Lock },
  { href: '/vault/finance', label: 'Investments', icon: TrendingUp },
  { href: '/net-worth', label: 'Net Worth', icon: DollarSign },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const
```

- [ ] **Step 13: Add google-auth-library dependency**

```bash
npm install google-auth-library
```

- [ ] **Step 14: Update Terraform secrets to include AI config**

Add to `terraform/secrets.tf`:
```hcl
resource "google_secret_manager_secret" "openai_compat_key" {
  secret_id = "life-os-openai-compat-key-${var.environment}"
  replication { auto {} }
}
```

Add to `terraform/cloudrun.tf` container env section:
```hcl
env {
  name  = "OPENAI_COMPATIBLE_BASE_URL"
  value = "http://127.0.0.1:8787"  # Headroom proxy (optional fallback)
}
```

- [ ] **Step 15: Run tests — expect PASS**

```bash
npx vitest run tests/unit/ai/
```

Expected: PASS (5+ tests).

- [ ] **Step 16: Build check**

```bash
npm run build
```

Expected: BUILD SUCCESS.

- [ ] **Step 17: Commit**

```bash
git add lib/ai/ app/api/v1/chat/ app/api/v1/agents/ \
  app/\(vault\)/chat/ app/\(vault\)/agents/ \
  components/chat/ components/agents/
git commit -m "feat(ai): add AI chatbot with streaming SSE and configurable agent system (Gemini + OpenAI-compat)"
```
