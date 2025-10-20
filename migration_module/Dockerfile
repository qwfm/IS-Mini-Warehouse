FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required to build Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV DOCKER_CONTAINER=true

# Make your script executable
RUN chmod +x alembic_cli.py

CMD ["bash", "-c", "echo 'Container ready, run: python alembic_cli.py' && tail -f /dev/null"]