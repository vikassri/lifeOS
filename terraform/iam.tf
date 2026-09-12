# Cloud Run runtime service account — least privilege
resource "google_service_account" "vault_sa" {
  account_id   = "life-os-vault-${var.environment}"
  display_name = "Life OS Vault Runtime SA (${var.environment})"
  description  = "Minimal permissions for Cloud Run vault service"
}

locals {
  # TODO(pre-prod): Replace project-level storage/datastore roles with resource-scoped bindings:
  # - google_storage_bucket_iam_member per bucket (not project-level)
  # - google_firestore_database_iam_member for specific database
  # Current project-level roles are acceptable for development but should be tightened before go-live.
  vault_sa_roles = [
    "roles/datastore.user",
    "roles/storage.objectAdmin",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
  ]
}

resource "google_project_iam_member" "vault_sa_roles" {
  for_each = toset(local.vault_sa_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.vault_sa.email}"
}
