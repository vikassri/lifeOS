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
