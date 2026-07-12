"""Cassandra / Scylla engine driver.

Used by Nexus OMS PRO mode for high-volume audit/activity storage. Provisioning
creates a keyspace + login role; deletion revokes the role but keeps the
keyspace (soft delete, matching the PostgreSQL behaviour). Backups use
``cqlsh`` (COPY) the same way PostgreSQL backups use ``pg_dump`` — make sure
``cqlsh`` is installed on the worker image.
"""

import os
import csv
import subprocess

from .base import BaseDriver


class CassandraDriver(BaseDriver):
    key = 'cassandra'
    label = 'Cassandra'
    default_port = 9042
    scheme = 'cassandra'
    _default_root_user = 'cassandra'

    def _cluster(self, server):
        from cassandra.cluster import Cluster, PlainTextAuthProvider
        from cassandra.auth import PlainTextAuthProvider as _PTA

        auth = _PTA(username=server.root_user, password=server.root_password)
        return Cluster([server.host], port=int(server.port), auth_provider=auth)

    def _session(self, server, keyspace=None):
        cluster = self._cluster(server)
        return cluster.connect(keyspace)

    # ------------------------------------------------------------------
    # Provisioning
    # ------------------------------------------------------------------
    def provision(self, server, instance):
        try:
            session = self._session(server)
            ks = instance.db_name
            session.execute(
                f"CREATE KEYSPACE IF NOT EXISTS {ks} "
                f"WITH replication = {{'class': 'SimpleStrategy', "
                f"'replication_factor': 3}} AND durable_writes = true"
            )
            session.execute(
                f"CREATE ROLE IF NOT EXISTS {instance.db_user} "
                f"WITH PASSWORD %s AND LOGIN = true",
                (instance.db_password_temp,),
            )
            session.execute(f"GRANT ALL ON KEYSPACE {ks} TO {instance.db_user}")
            session.cluster.shutdown()
            instance.status = 'available'
            instance.save()
        except Exception as e:  # pragma: no cover - surfaced via status
            print(f"Failed to provision cassandra keyspace {instance.id}: {e}")
            instance.status = 'failed'
            instance.save()

    def delete(self, server, instance):
        session = self._session(server)
        try:
            session.execute(f"REVOKE ALL ON KEYSPACE {instance.db_name} FROM {instance.db_user}")
            session.execute(f"DROP ROLE IF EXISTS {instance.db_user}")
        finally:
            session.cluster.shutdown()

    def build_connection_string(self, server, instance):
        return (
            f"{self.scheme}://{instance.db_user}:{instance.db_password_temp}"
            f"@{server.host}:{server.port}/{instance.db_name}"
        )

    # ------------------------------------------------------------------
    # Backup / restore
    # ------------------------------------------------------------------
    def _cqlsh(self, server):
        return [
            'cqlsh', server.host, str(server.port),
            '-u', server.root_user, '-p', server.root_password,
        ]

    def backup(self, server, instance, dest_path):
        os.makedirs(dest_path, exist_ok=True)
        ks = instance.db_name
        # 1. Schema
        schema_file = os.path.join(dest_path, 'schema.cql')
        with open(schema_file, 'w') as f:
            f.write(f"CREATE KEYSPACE IF NOT EXISTS {ks} "
                    f"WITH replication = {{'class': 'SimpleStrategy', "
                    f"'replication_factor': 3}} AND durable_writes = true;\n")
            f.write(f"GRANT ALL ON KEYSPACE {ks} TO {instance.db_user};\n")
        # 2. Per-table data via COPY
        session = self._session(server)
        try:
            rows = session.execute(
                "SELECT table_name FROM system_schema.tables WHERE keyspace_name = %s",
                (ks,),
            )
            tables = [r.table_name for r in rows]
        finally:
            session.cluster.shutdown()

        for table in tables:
            csv_path = os.path.join(dest_path, f"{table}.csv")
            cmd = self._cqlsh(server) + [
                '-e', f"COPY {ks}.{table} TO '{csv_path}' WITH HEADER=true"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                raise Exception(f"cqlsh COPY failed for {ks}.{table}: {result.stderr}")
        return dest_path

    def restore(self, server, instance, src_path):
        # Apply schema first so the keyspace/role exist.
        schema_file = os.path.join(src_path, 'schema.cql')
        if os.path.exists(schema_file):
            cmd = self._cqlsh(server) + ['-f', schema_file]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                raise Exception(f"cqlsh schema apply failed: {result.stderr}")
        # Load each csv back.
        for fname in os.listdir(src_path):
            if not fname.endswith('.csv'):
                continue
            table = fname[:-4]
            csv_path = os.path.join(src_path, fname)
            cmd = self._cqlsh(server) + [
                '-e', f"COPY {instance.db_name}.{table} FROM '{csv_path}' WITH HEADER=true"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                raise Exception(f"cqlsh COPY FROM failed for {table}: {result.stderr}")
        return src_path

    # ------------------------------------------------------------------
    # Studio
    # ------------------------------------------------------------------
    def connect(self, server, instance):
        return self._session(server, keyspace=instance.db_name)

    def get_tables(self, connection, instance):
        rows = connection.execute(
            "SELECT table_name FROM system_schema.tables WHERE keyspace_name = %s",
            (instance.db_name,),
        )
        return [r.table_name for r in rows]

    def get_table_data(self, connection, instance, table_name):
        if not table_name.isidentifier():
            raise ValueError("Invalid table name")
        qualified = f'"{instance.db_name}"."{table_name}"'
        result = connection.execute(f"SELECT * FROM {qualified} LIMIT 100")
        columns = list(result.column_names)
        rows = [dict(r) for r in result]

        pk_rows = connection.execute(
            "SELECT column_name, kind FROM system_schema.columns "
            "WHERE keyspace_name = %s AND table_name = %s",
            (instance.db_name, table_name),
        )
        primary_keys = [
            r.column_name for r in pk_rows
            if r.kind in ('partition_key', 'clustering')
        ]
        return {"columns": columns, "primary_keys": primary_keys, "rows": rows}

    def execute_query(self, connection, query):
        result = connection.execute(query)
        columns = list(result.column_names) if result.column_names else []
        rows = [dict(r) for r in result]
        return {"columns": columns, "rows": rows}

    def close(self, connection):
        if connection is not None:
            try:
                connection.cluster.shutdown()
            except Exception:
                pass
