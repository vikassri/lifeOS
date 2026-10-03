# Deployment Status

This version of lifeOS is local-first and stores its SQLite database and login
password hash in `.data/`. The previous Cloud Run/Terraform guide used Google
OAuth for sign-in and is no longer applicable. Do not use it to deploy this
version.

## Run Locally

```bash
bash scripts/setup-local.sh
npm run dev
```

Open `http://localhost:3000`. Sign in with the fixed username `onlyricks` and
the password configured by the setup script.

## Before Hosting Elsewhere

The host must provide durable, private storage for `.data/` and preserve it
across restarts. That directory contains the SQLite database and bcrypt
password hash; it must never be exposed as a public static directory or
committed to source control. Configure `SESSION_SECRET` and `ENCRYPTION_KEY`
through the host's secret-management facility. A production deployment recipe
is not provided until these storage and secret requirements are addressed.

## OpenNext Cloudflare Middleware Build Workaround

For an OpenNext build on Cloudflare, use `npm run build:cloudflare`. The
OpenNext adapter is pinned to `1.20.8`, and `patch-package` applies the
middleware bundling workaround in `patches/` during install. It only uses the
app's OpenTelemetry package if the copied middleware dependency includes its
ESM entry point; otherwise it uses Next.js's bundled copy.

Configure the Cloudflare build to install dependencies with the lockfile
(`npm ci`) and run `npm run build:cloudflare`. OpenNext also requires a
project-specific `wrangler.jsonc` before a normal build or deployment; this
checkout does not include one. The middleware bundle was verified locally
with `SKIP_WRANGLER_CONFIG_CHECK=yes npm run build:cloudflare`, which bypasses
only that preflight check.

This resolves the middleware bundle error; it does not make the app's local
SQLite database compatible with Cloudflare Workers.
