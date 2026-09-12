output "cloud_run_url" {
  description = "Cloud Run service URL"
  value       = google_cloud_run_v2_service.vault.uri
}

output "vault_service_account" {
  description = "Cloud Run service account email"
  value       = google_service_account.vault_sa.email
}

output "kms_key_name" {
  description = "Full KMS key resource name"
  value       = google_kms_crypto_key.data_key.id
  sensitive   = true
}

output "documents_bucket" {
  description = "GCS documents bucket name"
  value       = google_storage_bucket.documents.name
}
