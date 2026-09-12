resource "google_monitoring_notification_channel" "email" {
  display_name = "Life OS Alert Email"
  type         = "email"
  labels       = { email_address = var.alert_email }
}

resource "google_logging_metric" "auth_failures" {
  name   = "life-os-auth-failures-${var.environment}"
  filter = <<-EOT
    resource.type="cloud_run_revision"
    AND jsonPayload.event="login_blocked_allowlist"
  EOT
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_monitoring_alert_policy" "auth_failures" {
  display_name = "[Life OS ${var.environment}] Repeated Auth Failures"
  combiner     = "OR"

  conditions {
    display_name = "Auth failures > 5 in 5 minutes"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.auth_failures.name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]
  severity              = "CRITICAL"
}
