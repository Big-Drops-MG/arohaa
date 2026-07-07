variable "api_task_cpu" {
  type        = string
  description = "Fargate CPU units for the API task."
  default     = "1024"
}

variable "api_task_memory" {
  type        = string
  description = "Fargate memory (MiB) for the API task."
  default     = "3072"
}

variable "api_container_port" {
  type        = number
  description = "Container port exposed by the API."
  default     = 3001
}

variable "api_execution_role_arn" {
  type        = string
  description = "ECS task execution role ARN."
  default     = "arn:aws:iam::442042553666:role/ecsTaskExecutionRole"
}

variable "api_subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for the API ECS service."
  default = [
    "subnet-041a1d58307339aca",
    "subnet-00260c0ad1819d349",
    "subnet-0a904008542b548a6",
    "subnet-00eceeea2c9ac57ce",
    "subnet-0026f5db2aae3241e",
    "subnet-0f215f9fcc2679326",
  ]
}

variable "api_security_group_ids" {
  type        = list(string)
  description = "Security groups for the API ECS service."
  default     = ["sg-051f2c4c864b76921"]
}

variable "api_target_group_arn" {
  type        = string
  description = "ALB target group ARN for the API."
  default     = "arn:aws:elasticloadbalancing:us-east-1:442042553666:targetgroup/arohaa-api-tg/887a141a79790bb7"
}

variable "api_desired_count" {
  type        = number
  description = "Desired task count for the API service."
  default     = 1
}

variable "api_ecs_log_group_name" {
  type        = string
  description = "CloudWatch log group for ECS awslogs driver."
  default     = "/ecs/arohaa-api"
}

variable "database_url" {
  type        = string
  description = "Postgres connection string for the API."
  sensitive   = true
  default     = ""
}

variable "redis_url" {
  type        = string
  description = "Redis connection URL for the API."
  sensitive   = true
  default     = ""
}

variable "clickhouse_url" {
  type        = string
  description = "ClickHouse HTTP URL."
  default     = "http://137.184.17.135:8123"
}

variable "clickhouse_user" {
  type        = string
  description = "ClickHouse username."
  default     = "arohaa"
}

variable "clickhouse_password" {
  type        = string
  description = "ClickHouse password."
  sensitive   = true
  default     = ""
}

variable "api_container_aws_access_key_id" {
  type        = string
  description = "AWS access key injected into the API container for CloudWatch logs/metrics."
  sensitive   = true
  default     = ""
}

variable "api_container_aws_secret_access_key" {
  type        = string
  description = "AWS secret key injected into the API container."
  sensitive   = true
  default     = ""
}

variable "arohaa_internal_api_secret" {
  type        = string
  description = "Shared secret for dashboard-to-API analytics calls."
  sensitive   = true
  default     = ""
}
