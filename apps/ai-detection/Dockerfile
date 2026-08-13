FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DEFAULT_TIMEOUT=300 \
    PIP_RETRIES=10

WORKDIR /app

# Install system dependencies for OpenCV / Pillow and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install lightweight CPU-only PyTorch (avoids massive 1GB CUDA download & OOM on EC2)
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and pre-downloaded YOLO weights
COPY . .

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
