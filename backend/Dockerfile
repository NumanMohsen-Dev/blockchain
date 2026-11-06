FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2 and networking
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY alembic.ini .
COPY alembic/ ./alembic/
COPY app/ ./app/
COPY entrypoint.sh .

RUN chmod +x entrypoint.sh

# Persistent evidence storage volume
RUN mkdir -p /app/storage/evidence

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]

