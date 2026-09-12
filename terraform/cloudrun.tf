resource "google_cloud_run_v2_service" "vault" {
  name     = "life-os-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.vault_sa.email

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = var.container_image

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "GCP_REGION"
        value = var.region
      }

      env {
        name  = "KMS_KEY_NAME"
        value = google_kms_crypto_key.data_key.id
      }

      env {
        name = "GOOGLE_CLIENT_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app_secrets["oauth_client_id"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "GOOGLE_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app_secrets["oauth_client_secret"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app_secrets["session_secret"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "GOOGLE_REDIRECT_URI"
        value = "https://YOUR_CLOUD_RUN_URL/api/auth/callback"
        # Update this value after first Terraform apply using the Cloud Run URL from outputs
      }

      liveness_probe {
        http_get { path = "/api/v1/health" }
        initial_delay_seconds = 5
        period_seconds        = 30
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_project_iam_member.vault_sa_roles,
  ]
}

# Make the service publicly accessible (auth is handled by the app)
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  name     = google_cloud_run_v2_service.vault.name
  location = google_cloud_run_v2_service.vault.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
