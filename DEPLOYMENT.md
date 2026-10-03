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
