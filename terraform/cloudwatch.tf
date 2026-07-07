resource "aws_cloudwatch_log_group" "api" {
  name              = var.cloudwatch_log_group_name
  retention_in_days = 30
}

resource "aws_cloudwatch_metric_alarm" "analytics_queue_depth" {
  alarm_name          = "arohaa-analytics-queue-depth"
  alarm_description   = "Alert when analytics_queue depth stays high (ARHT32)"
  namespace           = local.metric_namespace
  metric_name         = "analytics_queue_depth"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = var.analytics_queue_alarm_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "failed_events_depth" {
  alarm_name          = "arohaa-failed-events-depth"
  alarm_description   = "Alert when failed_events DLQ depth stays high"
  namespace           = local.metric_namespace
  metric_name         = "failed_events_depth"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = var.failed_events_alarm_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}
