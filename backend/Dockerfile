# backend/Dockerfile

FROM python:3.9

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install postgresql-client for pg_dump and cassandra-tools for cqlsh (Cassandra backups)
RUN apt-get update && apt-get install -y postgresql-client cassandra-tools && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/
RUN pip install -r requirements.txt

COPY . /app/