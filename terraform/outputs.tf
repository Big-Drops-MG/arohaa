output "ecr_repository_url" {
  description = "ECR URL for the ingestion API image."
  value       = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_arn" {
  description = "ARN of the production ECS cluster (data source)."
  value       = data.aws_ecs_cluster.api.arn
}

output "ecs_service_name" {
  description = "Name of the production ECS API service (data source)."
  value       = data.aws_ecs_service.api.service_name
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
