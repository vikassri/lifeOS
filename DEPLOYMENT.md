# Deployment Guide — Google Cloud Platform

Step-by-step guide to deploy Life OS to Cloud Run using Terraform.

## Prerequisites

- Google Cloud account with billing enabled
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- [Docker](https://docs.docker.com/get-docker/) (for building the container image)
- Node.js 22+ (for local builds)

## 1. Create GCP Project

```bash
export PROJECT_ID="life-os-prod"
export REGION="asia-southeast1"

gcloud projects create $PROJECT_ID --name="Life OS"
gcloud billing projects link $PROJECT_ID --billing-account=YOUR_BILLING_ACCOUNT_ID
gcloud config set project $PROJECT_ID
```

## 2. Enable Authentication

```bash
gcloud auth login
gcloud auth application-default login
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

## 3. Configure OAuth 2.0

1. Go to **GCP Console → APIs & Services → OAuth consent screen**
   - User type: External (or Internal if using Workspace)
   - Add `er.vikassri@gmail.com` as a test user
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: Web application
   - Authorized redirect URIs:
     - `https://YOUR_CLOUD_RUN_URL/api/auth/callback` (add after first deploy)
     - `http://localhost:3000/api/auth/callback` (for local dev)
3. Save the **Client ID** and **Client Secret**

## 4. Apply Terraform Infrastructure

```bash
cd terraform

# Initialize Terraform
terraform init

# Plan for production
terraform plan \
  -var-file=environments/prod.tfvars \
  -var="project_id=$PROJECT_ID"

# Apply
terraform apply \
  -var-file=environments/prod.tfvars \
  -var="project_id=$PROJECT_ID"
```

This creates:

- Cloud Run service (`life-os-prod`)
- Firestore database (asia-southeast1)
- KMS key ring and encryption key
- Secret Manager secret containers
- Cloud Storage buckets (documents + backups)
- Service account with least-privilege IAM roles
- Cloud Monitoring alert for auth failures

## 5. Populate Secrets

Terraform creates secret containers but does **not** store values. Populate them manually:

```bash
# Session secret (64 hex chars)
openssl rand -hex 32 | gcloud secrets versions add life-os-session-secret-prod --data-file=-

# OAuth client ID
echo -n "YOUR_CLIENT_ID" | gcloud secrets versions add life-os-oauth-client-id-prod --data-file=-

# OAuth client secret
echo -n "YOUR_CLIENT_SECRET" | gcloud secrets versions add life-os-oauth-client-secret-prod --data-file=-
```

## 6. Build and Push Container

```bash
# From project root
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/life-os/vault:latest"

# Create Artifact Registry repository (one-time)
gcloud artifacts repositories create life-os \
  --repository-format=docker \
  --location=$REGION

# Build and push
docker build -t $IMAGE .
docker push $IMAGE
```

## 7. Deploy to Cloud Run

Update the container image and redeploy:

```bash
cd terraform

terraform apply \
  -var-file=environments/prod.tfvars \
  -var="project_id=$PROJECT_ID" \
  -var="container_image=$IMAGE"
```

Get the service URL:

```bash
terraform output cloud_run_url
```

## 8. Post-Deploy Configuration

1. **Update OAuth redirect URI** — add `https://YOUR_CLOUD_RUN_URL/api/auth/callback` in GCP Console
2. **Verify health check** — `curl https://YOUR_CLOUD_RUN_URL/api/v1/health`
3. **Test login** — visit the URL and sign in with the authorized Google account
4. **Custom domain** (optional):

```bash
gcloud run domain-mappings create \
  --service=life-os-prod \
  --domain=vault.yourdomain.com \
  --region=$REGION
```

## 9. Verify Deployment

```bash
# Health check
curl -s https://YOUR_CLOUD_RUN_URL/api/v1/health | jq .

# Run E2E tests against deployed instance
PLAYWRIGHT_BASE_URL=https://YOUR_CLOUD_RUN_URL npx playwright test
```

## Environments

| Environment | Terraform vars | KMS key | Cloud Run service |
|-------------|---------------|---------|-------------------|
| dev | `environments/dev.tfvars` | `dev-data-key` | `life-os-dev` |
| prod | `environments/prod.tfvars` | `prod-data-key` | `life-os-prod` |

Use Terraform workspaces or separate var files to manage multiple environments.

## Rollback

```bash
# List revisions
gcloud run revisions list --service=life-os-prod --region=$REGION

# Route 100% traffic to a previous revision
gcloud run services update-traffic life-os-prod \
  --to-revisions=REVISION_NAME=100 \
  --region=$REGION
```

## Estimated Cost

~$2–5/month for single-user usage (Cloud Run, Firestore free tier, KMS, Secret Manager, Storage).
