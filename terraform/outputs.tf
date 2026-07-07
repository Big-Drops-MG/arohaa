output "ecr_repository_url" {
  description = "ECR URL for the ingestion API image."
  value       = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_arn" {
  description = "ARN of the production ECS cluster (data source)."
  value       = data.aws_ecs_cluster.api.arn
}

output "ecs_service_name" {
  description = "Name of the production ECS API service."
  value       = aws_ecs_service.api.name
}

output "ecs_task_definition_arn" {
  description = "Latest ECS task definition ARN for the API."
  value       = aws_ecs_task_definition.api.arn
}

output "terraform_state_bucket" {
  description = "S3 bucket used for Terraform remote state."
  value       = aws_s3_bucket.terraform_state.bucket
}

output "cloudwatch_alarms" {
  description = "Queue monitoring alarm names managed by Terraform."
  value = [
    aws_cloudwatch_metric_alarm.analytics_queue_depth.alarm_name,
    aws_cloudwatch_metric_alarm.failed_events_depth.alarm_name,
  ]
}

output "cloudwatch_metric_namespace" {
  description = "Custom metric namespace for queue depth metrics."
  value       = local.metric_namespace
}
