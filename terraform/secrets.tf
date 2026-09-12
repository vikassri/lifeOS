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
