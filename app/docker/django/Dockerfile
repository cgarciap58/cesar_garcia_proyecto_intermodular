# Base image (Debian-based, slim)
FROM python:3.12-slim

# Prevent Python from writing pyc files
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

RUN apt-get update && apt-get install -y \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# System dependencies (mysqlclient needs these later)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        default-libmysqlclient-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# Copy project
COPY src/ .

# Create directories for static & media
RUN mkdir -p /app/staticfiles /app/media

# Expose Gunicorn port
EXPOSE 8000

COPY docker/django/entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

# Default command (overridden later by docker-compose)
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "2"]

