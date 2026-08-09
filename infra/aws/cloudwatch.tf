# --- SNS Topic for CloudWatch Alarms ---
resource "aws_sns_topic" "alerts" {
  name = "classpod-alarms-${var.environment}"
}

# --- CloudWatch Metric Filters ---
resource "aws_cloudwatch_log_metric_filter" "api_5xx_errors" {
  name           = "ClassPodApi5xxErrors"
  pattern        = "[timestamp, requestId, level = *ERROR*, ...]"
  log_group_name = aws_cloudwatch_log_group.api_logs.name

  metric_transformation {
    name          = "ApiErrorCount"
    namespace     = "ClassPod/Application"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "gateway_heartbeats" {
  name           = "ClassPodGatewayHeartbeats"
  pattern        = "heartbeat"
  log_group_name = aws_cloudwatch_log_group.api_logs.name

  metric_transformation {
    name          = "HeartbeatCount"
    namespace     = "ClassPod/Application"
    value         = "1"
    default_value = "0"
  }
}

# --- CloudWatch Metric Alarms ---
resource "aws_cloudwatch_metric_alarm" "high_api_errors" {
  alarm_name          = "classpod-high-api-errors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "ApiErrorCount"
  namespace           = "ClassPod/Application"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Triggered when API logs record >= 5 error events in 5 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "ecs_high_cpu" {
  alarm_name          = "classpod-ecs-high-cpu-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Triggered when ECS Cluster CPU utilization exceeds 80% for 10 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_high_memory" {
  alarm_name          = "classpod-ecs-high-memory-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Triggered when ECS Cluster Memory utilization exceeds 85% for 10 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
  }
}

# --- Central CloudWatch Dashboard ---
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "ClassPod-${var.environment}-Overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name, { stat = "Average", period = 60, label = "ECS CPU Utilization (%)" }],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.main.name, { stat = "Average", period = 60, label = "ECS Memory Utilization (%)" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ECS Cluster Compute Utilization"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["ClassPod/Application", "ApiErrorCount", { stat = "Sum", period = 60, color = "#d62728", label = "API Error Count" }],
            ["ClassPod/Application", "HeartbeatCount", { stat = "Sum", period = 60, color = "#2ca02c", label = "Gateway Heartbeats" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Application Activity & Errors"
          period  = 60
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        properties = {
          query   = "SOURCE '${aws_cloudwatch_log_group.api_logs.name}' | fields @timestamp, @message | filter @message like /error/ or @message like /ERROR/ | sort @timestamp desc | limit 50"
          region  = var.aws_region
          title   = "Recent API Error Logs"
          view    = "table"
        }
      }
    ]
  })
}
