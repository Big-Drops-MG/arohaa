resource "aws_iam_user_policy" "api_queue_monitoring" {
  name = "arohaa-queue-monitoring"
  user = var.api_iam_user_name

  policy = file("${path.module}/../deploy/iam-queue-monitoring-policy.json")
}
