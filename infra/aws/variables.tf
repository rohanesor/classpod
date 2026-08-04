variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS deployment target region"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Deployment environment (production/staging)"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Master password for RDS PostgreSQL instance"
}

variable "jwt_secret" {
  type        = string
  sensitive   = true
  description = "JWT secret key for NestJS authentication"
}

variable "gateway_shared_secret" {
  type        = string
  sensitive   = true
  description = "Shared secret for ESP32 hardware authentication"
}
