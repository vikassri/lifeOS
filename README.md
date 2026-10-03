# lifeOS — Personal Life OS

Private, single-user lifeOS application with local SQLite storage.

**Access:** Login is restricted to the `onlyricks` username and the password configured during local setup.

## Stack

- Next.js 14 + TypeScript + Tailwind CSS
- SQLite (local `.data/` directory)
- Local AES-256-GCM encryption
- iron-session (encrypted HTTP-only cookies)

## Local Development

### Prerequisites

```bash
bash scripts/setup-local.sh
```

The setup script creates `.env.local` when needed, generates local secrets, installs dependencies, and prompts for the `onlyricks` password. Its bcrypt hash is stored in `.data/password.hash`, which is gitignored. Start the app with `npm run dev`.

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

## Security

See [SECURITY.md](SECURITY.md) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).
