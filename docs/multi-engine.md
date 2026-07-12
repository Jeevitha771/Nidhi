# Nidhi Multi-Engine Support

Nidhi manages more than one database engine. This document describes how the
abstraction works and how to add or operate a new engine.

## Supported engines

| Engine      | Key           | Default port | Used by                                  |
|-------------|---------------|--------------|------------------------------------------|
| PostgreSQL  | `postgresql`  | 5432         | Default; Nexus OMS PRO relational store  |
| Cassandra   | `cassandra`   | 9042         | Nexus OMS PRO audit/activity store       |

## Architecture

Every engine implements `backend/api/engine_drivers/base.py:BaseDriver`. The rest
of the codebase talks only to `get_driver(instance.engine)`:

- **Provisioning** — `driver.provision(server, instance)` creates the
  database/keyspace + login role. `provision_database_task` (Celery) calls this.
- **Soft delete** — `driver.delete(server, instance)` revokes access but keeps
  data (matches the old PostgreSQL `REVOKE CONNECT` behaviour).
- **Credentials** — `driver.build_connection_string(...)` returns a URI the
  consuming app uses (`postgres://...` or `cassandra://...`). Used by
  `reveal_credentials`, `auto_provision_instance`, and the heartbeat check.
- **Backup / restore** — `driver.backup(...)` / `driver.restore(...)`.
  PostgreSQL uses `pg_dump`/`pg_restore`; Cassandra uses `cqlsh COPY` (requires
  `cassandra-tools` / `cqlsh` on the worker image — see `backend/Dockerfile`).
- **Studio** — `driver.connect/get_tables/get_table_data/execute_query/close`
  drive the Database Studio UI. PostgreSQL uses `information_schema`; Cassandra
  browses `system_schema` and runs CQL.
- **Replication** — `replicate_prod_to_dev` dumps from the source engine and
  restores into a target instance of the same engine.

## Registering a server of a given engine

`POST /nidhi-api/servers/` with:

```json
{ "name": "Cassandra Prod", "host": "10.0.0.9", "engine": "cassandra",
  "root_user": "cassandra", "root_password": "...", "environment_type": "prod" }
```

When `port` is omitted it defaults to the engine's standard port (5432 / 9042)
and `root_user` to the engine default (`postgres` / `cassandra`).

## Auto-provision from an app

`POST /nidhi-api/instances/auto-provision/` accepts an optional `engine` field.
Nidhi picks an active server of that engine + environment and returns a matching
connection string.

## Adding a new engine

1. Create `backend/api/engine_drivers/<engine>.py` subclassing `BaseDriver`.
2. Register it in `backend/api/engine_drivers/__init__.py:DRIVERS`.
3. Add the choice to `ENGINE_CHOICES` in `backend/api/models.py`.
4. (Optional) add the client library to `backend/requirements.txt` and any CLI
   tools to `backend/Dockerfile`.

No changes to views, tasks, serializers, or the frontend are required — they
already route through `get_driver()`.
