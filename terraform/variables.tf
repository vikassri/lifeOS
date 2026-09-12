variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-southeast1"
}

variable "environment" {
  description = "Environment: dev, staging, prod"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "alert_email" {
  description = "Email for monitoring alerts"
  type        = string
  default     = "er.vikassri@gmail.com"
}

variable "container_image" {
  description = "Full container image URI (e.g. asia-northeast1-docker.pkg.dev/...)"
  type        = string
  default     = "gcr.io/cloudrun/placeholder"
}
