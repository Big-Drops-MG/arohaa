locals {
  metric_namespace = "Arohaa/Custom"

  alarm_actions = var.cloudwatch_alarm_sns_arn != "" ? [var.cloudwatch_alarm_sns_arn] : []
}
