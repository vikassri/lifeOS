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
# Fill in values from Secret Manager or GCP Console
```

### Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated requests redirect to `/login`.

### Test

```bash
npx vitest run tests/unit/     # unit tests
npm test                       # all Vitest tests (unit + integration)
npx playwright test            # e2e (requires dev server + browser install)
```

### Build

```bash
npm run build
```

## Project Structure

```
app/           Next.js App Router (auth, vault pages, API routes)
lib/           Auth, encryption, security, audit, database clients
terraform/     GCP infrastructure as code
tests/         Unit, integration, and E2E test suites
docs/          Architecture, security, and threat model documentation
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).

## Security

See [SECURITY.md](SECURITY.md) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Design Spec

Full foundation design: [docs/superpowers/specs/2026-09-12-personal-life-os-foundation-design.md](docs/superpowers/specs/2026-09-12-personal-life-os-foundation-design.md).
