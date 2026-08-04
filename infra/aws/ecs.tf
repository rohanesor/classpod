# --- ECS Fargate Cluster ---
resource "aws_ecs_cluster" "main" {
  name = "classpod-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# --- CloudWatch Log Groups ---
resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/ecs/classpod-api-${var.environment}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "worker_logs" {
  name              = "/ecs/classpod-worker-${var.environment}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "ai_logs" {
  name              = "/ecs/classpod-ai-${var.environment}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "web_logs" {
  name              = "/ecs/classpod-web-${var.environment}"
  retention_in_days = 30
}

# --- Task Definitions & Services ---
resource "aws_ecs_task_definition" "api" {
  family                   = "classpod-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512  # 0.5 vCPU
  memory                   = 1024 # 1 GB RAM
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${aws_ecr_repository.api.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 4000
          hostPort      = 4000
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "API_PORT", value = "4000" },
        { name = "STORAGE_DRIVER", value = "s3" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "AWS_S3_BUCKET", value = aws_s3_bucket.storage.id }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.db_secret.arn}:DATABASE_URL::" },
        { name = "REDIS_URL", valueFrom = "${aws_secretsmanager_secret.redis_secret.arn}:REDIS_URL::" },
        { name = "JWT_SECRET", valueFrom = "${aws_secretsmanager_secret.jwt_secret.arn}:JWT_SECRET::" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api_logs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "api" {
  name            = "classpod-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_groups = [aws_security_group.ecs_sg.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 4000
  }
}
