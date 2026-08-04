terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ClassPod-Hackathon"
      Environment = "demo"
      ManagedBy   = "Terraform"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "ap-southeast-2" # Sydney region as shown in console
}

# --- Minimal VPC & Security Group ---
resource "aws_vpc" "demo" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "classpod-demo-vpc" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.demo.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = { Name = "classpod-demo-subnet" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.demo.id

  tags = { Name = "classpod-demo-igw" }
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.demo.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
}

resource "aws_route_table_association" "public_assoc" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public_rt.id
}

resource "aws_security_group" "demo_sg" {
  name        = "classpod-demo-sg"
  description = "Security group for ClassPod hackathon demo EC2"
  vpc_id      = aws_vpc.demo.id

  # Web Dashboard (Port 80 & 3000)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # NestJS API Backend (Port 4000)
  ingress {
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # AI Detection Microservice (Port 5000)
  ingress {
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH Access (Port 22)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- S3 Storage Bucket ---
resource "aws_s3_bucket" "demo_storage" {
  bucket        = "classpod-demo-storage-sydney-${random_string.suffix.result}"
  force_destroy = true
}

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# --- Latest Ubuntu 22.04 AMI ---
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

# --- Hackathon EC2 Instance (t3.medium: 2 vCPU, 4GB RAM) ---
resource "aws_instance" "demo_ec2" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.medium"
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.demo_sg.id]

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  user_data = <<-EOF
              #!/bin/bash
              apt-get update
              apt-get install -y docker.io docker-compose-plugin git curl
              systemctl enable --now docker
              usermod -aG docker ubuntu
              EOF

  tags = { Name = "classpod-hackathon-demo-node" }
}

resource "aws_eip" "demo_eip" {
  instance = aws_instance.demo_ec2.id
  domain   = "vpc"
}

output "demo_public_ip" {
  value       = aws_eip.demo_eip.public_ip
  description = "Public IP address for Hackathon live demo"
}

output "web_url" {
  value       = "http://${aws_eip.demo_eip.public_ip}:3000"
  description = "ClassPod Web Dashboard URL"
}

output "api_url" {
  value       = "http://${aws_eip.demo_eip.public_ip}:4000"
  description = "ClassPod NestJS API URL"
}
