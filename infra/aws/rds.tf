resource "aws_db_subnet_group" "rds_subnets" {
  name       = "classpod-rds-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  tags = {
    Name = "classpod-rds-subnets"
  }
}

resource "aws_db_parameter_group" "postgres_params" {
  name   = "classpod-pg16-params"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "classpod-db-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16.1"
  instance_class         = "db.t4g.small"
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp3"
  multi_az               = var.environment == "production" ? true : false
  db_name                = "classpod"
  username               = "classpod"
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.rds_subnets.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  parameter_group_name   = aws_db_parameter_group.postgres_params.name

  skip_final_snapshot    = var.environment == "production" ? false : true
  final_snapshot_identifier = "classpod-db-final-${var.environment}"

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:30-Mon:05:30"
}
