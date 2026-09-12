# Threat Model — STRIDE Analysis

Foundation-layer threat model for Personal Life OS. Based on the [foundation design spec](../superpowers/specs/2026-09-12-personal-life-os-foundation-design.md).

## Scope

This analysis covers Sub-Project 1 (Foundation): authentication, session management, API middleware, encryption, and infrastructure.

## Assets

| Asset | Sensitivity |
|-------|-------------|
| User session cookie | High |
| OAuth client secret | Critical |
| KMS encryption keys | Critical |
| Firestore data (vault entries, audit logs) | High |
| GCS documents | High |
| User email / Google sub | Medium |

## STRIDE Summary

| Threat | Category | Attack Vector | Mitigation | Status |
|--------|----------|---------------|------------|--------|
| OAuth token theft via XSS | Spoofing | Malicious script reads tokens from DOM/localStorage | Tokens never stored in browser; CSP with nonce; HttpOnly cookies | Mitigated |
| Session fixation | Spoofing | Attacker sets victim's session ID | New session created on login; session rotation on each request | Mitigated |
| CSRF on API routes | Tampering | Forged cross-origin request with valid session cookie | Double-submit CSRF token validated on every API call | Mitigated |
| MITM / token interception | Info Disclosure | Network eavesdropping on auth flow | TLS 1.3 only; HSTS preload | Mitigated |
| Unauthorized API access | Elevation of Privilege | Direct API calls without valid session | Server-side allowlist checked on every request | Mitigated |
| Insecure Direct Object Reference | Elevation of Privilege | Manipulating userId in API path/body | userId derived from session, never from client input | Mitigated |
| KMS key compromise | Info Disclosure | Over-privileged IAM or leaked credentials | Least-privilege IAM; 365-day key rotation; audit trail | Mitigated |
| OAuth client secret leak | Info Disclosure | Secret in source code or logs | Secret Manager only; never in code or env files in repo | Mitigated |
| Brute-force login | Denial of Service | Automated login attempts | Cloud Armor rate limiting; Google handles OAuth brute-force | Mitigated |
| Open redirect after auth | Spoofing | Manipulated `next` parameter | Redirect target validated against allowlist of paths | Mitigated |
| Malicious GCS upload | Tampering | Upload of executable or oversized file | MIME + magic bytes + size validation; signed URLs only | Planned (Sub-Project 4) |
| Session cookie theft | Spoofing | XSS or network sniffing | HttpOnly + Secure + SameSite=Lax; CSP prevents XSS | Mitigated |
| Audit log tampering | Repudiation | Attacker modifies or deletes audit entries | Write-once Firestore documents; Admin SDK only; no delete API | Mitigated |
| Container escape | Elevation of Privilege | Exploit Cloud Run sandbox | Google-managed infrastructure; minimal container surface | Accepted risk |

## Residual Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Google account compromise | High | Mitigated by Google's 2FA; outside app control |
| Cloud Run container escape | Low | Google-managed infrastructure risk |
| KMS key mismanagement | Medium | Operator responsibility; rotation and IAM audit required |
| Operator error (misconfigured secrets) | Medium | Terraform + Secret Manager reduce but don't eliminate |
| Supply chain (npm dependency) | Medium | npm audit + Semgrep in CI pipeline |

## Security Controls Matrix

```
                    Prevent    Detect    Respond
Authentication      ✓          ✓         ✓ (audit log)
Authorization       ✓          ✓         ✓ (audit log)
Encryption          ✓          —         —
Input validation    ✓          —         —
Rate limiting       ✓          ✓         ✓ (Cloud Armor)
Audit logging       —          ✓         ✓
Monitoring          —          ✓         ✓ (email alerts)
```

## Review Schedule

This threat model should be reviewed when:

- A new sub-project adds data types or API routes
- Authentication or encryption mechanisms change
- A security incident occurs
- GCP services or IAM roles are modified
