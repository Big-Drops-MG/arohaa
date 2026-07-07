data "aws_ecs_cluster" "api" {
  cluster_name = var.ecs_cluster_name
}
