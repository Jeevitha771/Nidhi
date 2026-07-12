# backend/Dockerfile

FROM python:3.9

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install postgresql-client for pg_dump. (cqlsh for Cassandra backups is
# installed via pip below, since `cassandra-tools` is not in Debian repos.)
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/
RUN pip install -r requirements.txt
# cqlsh CLI for Cassandra backup/restore
RUN pip install cqlsh

COPY . /app/