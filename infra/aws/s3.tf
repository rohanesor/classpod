resource "aws_s3_bucket" "storage" {
  bucket = "classpod-storage-${var.environment}"

  tags = {
    Name = "classpod-storage"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage_crypto" {
  bucket = aws_s3_bucket.storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "storage_cors" {
  bucket = aws_s3_bucket.storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = ["https://app.classpod.io"]
    max_age_seconds = 3000
  }
}
