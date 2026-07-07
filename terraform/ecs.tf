resource "aws_cloudwatch_log_group" "api_ecs" {
  name              = var.api_ecs_log_group_name
  retention_in_days = 30
}

resource "aws_ecs_task_definition" "api" {
  family                   = "arohaa-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_task_cpu
  memory                   = var.api_task_memory
  execution_role_arn       = var.api_execution_role_arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${aws_ecr_repository.api.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = var.api_container_port
          hostPort      = var.api_container_port
          protocol      = "tcp"
          name          = "api-${var.api_container_port}-tcp"
          appProtocol   = "http"
        },
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = tostring(var.api_container_port) },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "CLICKHOUSE_URL", value = var.clickhouse_url },
        { name = "CLICKHOUSE_USER", value = var.clickhouse_user },
        { name = "CLICKHOUSE_PASSWORD", value = var.clickhouse_password },
        { name = "DATABASE_URL", value = var.database_url },
        { name = "REDIS_URL", value = var.redis_url },
        { name = "AWS_ACCESS_KEY_ID", value = var.api_container_aws_access_key_id },
        { name = "AWS_SECRET_ACCESS_KEY", value = var.api_container_aws_secret_access_key },
        { name = "AROHAA_INTERNAL_API_SECRET", value = var.arohaa_internal_api_secret },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api_ecs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
          awslogs-create-group  = "true"
        }
      }
    },
  ])
}

resource "aws_ecs_service" "api" {
  name            = var.ecs_service_name
  cluster         = data.aws_ecs_cluster.api.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.api_subnet_ids
    security_groups  = var.api_security_group_ids
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = var.api_target_group_arn
    container_name   = "api"
    container_port   = var.api_container_port
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  lifecycle {
    ignore_changes = [desired_count]
  }
}
