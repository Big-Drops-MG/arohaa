variable "aws_region" {
  type        = string
  description = "AWS region for Arohaa production resources."
  default     = "us-east-1"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account ID."
  default     = "442042553666"
}

variable "ecs_cluster_name" {
  type        = string
  description = "Existing ECS cluster hosting the ingestion API."
  default     = "arohaa-production"
}

variable "ecs_service_name" {
  type        = string
  description = "Existing ECS service for the ingestion API."
  default     = "arohaa-api-service-syjf98zg"
}

variable "api_ecr_repository_name" {
  type        = string
  description = "ECR repository for the ingestion API image."
  default     = "arohaa-api"
}

variable "api_iam_user_name" {
  type        = string
  description = "IAM user whose keys the API task uses for CloudWatch logs and metrics."
  default     = "arohaa-backend-logger"
}

variable "cloudwatch_alarm_sns_arn" {
  type        = string
  description = "Optional SNS topic ARN for queue depth alarm actions."
  default     = ""
}

variable "analytics_queue_alarm_threshold" {
  type        = number
  description = "Alert when analytics_queue depth exceeds this value."
  default     = 5000
}

variable "failed_events_alarm_threshold" {
  type        = number
  description = "Alert when failed_events DLQ depth exceeds this value."
  default     = 100
}

variable "cloudwatch_log_group_name" {
  type        = string
  description = "CloudWatch log group for API production logs."
  default     = "/arohaa/production/fastify-backend"
}
