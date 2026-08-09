#!/bin/bash
set -euo pipefail

echo "============================================================"
echo "Installing & Configuring AWS CloudWatch Agent for ClassPod"
echo "============================================================"

# Download and install Amazon CloudWatch Agent for Ubuntu (deb package)
ARCH=$(dpkg --print-architecture)
if [ "$ARCH" = "arm64" ]; then
  PACKAGE_URL="https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/arm64/latest/amazon-cloudwatch-agent.deb"
else
  PACKAGE_URL="https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb"
fi

echo "Downloading CloudWatch Agent from: $PACKAGE_URL"
curl -sSL "$PACKAGE_URL" -o /tmp/amazon-cloudwatch-agent.deb
sudo dpkg -i -E /tmp/amazon-cloudwatch-agent.deb
rm -f /tmp/amazon-cloudwatch-agent.deb

# Copy configuration
CONFIG_DIR="/opt/aws/amazon-cloudwatch-agent/etc"
sudo mkdir -p "$CONFIG_DIR"
sudo cp "$(dirname "$0")/amazon-cloudwatch-agent.json" "$CONFIG_DIR/amazon-cloudwatch-agent.json"

# Start and enable CloudWatch Agent systemd service
echo "Starting CloudWatch Agent service..."
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c "file:$CONFIG_DIR/amazon-cloudwatch-agent.json"

sudo systemctl status amazon-cloudwatch-agent --no-pager

echo "============================================================"
echo "CloudWatch Agent successfully installed and running!"
echo "Metrics Namespace: ClassPod/EC2"
echo "Log Groups: /classpod/ec2/system, /classpod/ec2/docker-containers"
echo "============================================================"
