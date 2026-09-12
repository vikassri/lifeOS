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
