data "aws_ecs_cluster" "api" {
  cluster_name = var.ecs_cluster_name
}

data "aws_ecs_service" "api" {
  cluster_arn  = data.aws_ecs_cluster.api.arn
  service_name = var.ecs_service_name
}
