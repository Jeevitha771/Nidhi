"""PostgreSQL engine driver (previously the only supported engine)."""

import os
import subprocess

import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor

from .base import BaseDriver


class PostgresDriver(BaseDriver):
    key = 'postgresql'
    label = 'PostgreSQL'
    default_port = 5432
    scheme = 'postgres'

    # ------------------------------------------------------------------
    # Provisioning
    # ------------------------------------------------------------------
    def provision(self, server, instance):
        try:
            conn = psycopg2.connect(
                dbname="postgres",
                user=server.root_user,
                password=server.root_password,
                host=server.host,
                port=server.port,
            )
            conn.autocommit = True
            cursor = conn.cursor()

            create_user = sql.SQL("CREATE USER {user} WITH PASSWORD {password}").format(
                user=sql.Identifier(instance.db_user),
                password=sql.Literal(instance.db_password_temp),
            )
            create_db = sql.SQL("CREATE DATABASE {db_name}").format(
                db_name=sql.Identifier(instance.db_name)
            )
            grant = sql.SQL("GRANT ALL PRIVILEGES ON DATABASE {db_name} TO {user}").format(
                db_name=sql.Identifier(instance.db_name),
                user=sql.Identifier(instance.db_user),
            )
            cursor.execute(create_user)
            cursor.execute(create_db)
            cursor.execute(grant)
            cursor.close()
            conn.close()

            # PG 15+ — grant schema public permissions on the new database.
            conn2 = psycopg2.connect(
                dbname=instance.db_name,
                user=server.root_user,
                password=server.root_password,
                host=server.host,
                port=server.port,
            )
            conn2.autocommit = True
            cursor2 = conn2.cursor()
            cursor2.execute(
                sql.SQL("GRANT ALL ON SCHEMA public TO {user}").format(
                    user=sql.Identifier(instance.db_user)
                )
            )
            cursor2.execute(
                sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO {user}").format(
                    user=sql.Identifier(instance.db_user)
                )
            )
            cursor2.execute(
                sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO {user}").format(
                    user=sql.Identifier(instance.db_user)
                )
            )
            cursor2.execute(
                sql.SQL("ALTER ROLE {user} SET search_path TO public").format(
                    user=sql.Identifier(instance.db_user)
                )
            )
            cursor2.close()
            conn2.close()

            instance.status = 'available'
            instance.save()
        except Exception as e:  # pragma: no cover - surfaced via status
            print(f"Failed to provision database {instance.id}: {e}")
            instance.status = 'failed'
            instance.save()

    def delete(self, server, instance):
        conn = psycopg2.connect(
            dbname="postgres",
            user=server.root_user,
            password=server.root_password,
            host=server.host,
            port=server.port,
        )
        conn.autocommit = True
        cursor = conn.cursor()

        revoke = sql.SQL("REVOKE CONNECT ON DATABASE {db_name} FROM PUBLIC, {user};").format(
            db_name=sql.Identifier(instance.db_name),
            user=sql.Identifier(instance.db_user),
        )
        cursor.execute(revoke)
        terminate = sql.SQL(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s;"
        )
        cursor.execute(terminate, [instance.db_name])
        cursor.close()
        conn.close()

    def build_connection_string(self, server, instance):
        return (
            f"{self.scheme}://{instance.db_user}:{instance.db_password_temp}"
            f"@{server.host}:{server.port}/{instance.db_name}"
        )

    # ------------------------------------------------------------------
    # Backup / restore
    # ------------------------------------------------------------------
    def backup(self, server, instance, dest_path):
        os.environ['PGPASSWORD'] = server.root_password
        command = [
            'pg_dump',
            '-h', server.host,
            '-p', str(server.port),
            '-U', server.root_user,
            '-F', 'c',  # custom format for pg_restore
            '-f', dest_path,
            instance.db_name,
        ]
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(f"pg_dump failed: {result.stderr}")
        return dest_path

    def restore(self, server, instance, src_path):
        os.environ['PGPASSWORD'] = server.root_password
        command = [
            'pg_restore', '-h', server.host, '-p', str(server.port),
            '-U', server.root_user, '-d', instance.db_name, '-O', '-x', src_path,
        ]
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0 and "warnings" not in result.stderr.lower():
            raise Exception(f"pg_restore failed: {result.stderr}")
        return src_path

    # ------------------------------------------------------------------
    # Studio
    # ------------------------------------------------------------------
    def connect(self, server, instance):
        return psycopg2.connect(
            dbname=instance.db_name,
            user=server.root_user,
            password=server.root_password,
            host=server.host,
            port=server.port,
            cursor_factory=RealDictCursor,
        )

    def get_tables(self, connection, instance):
        cursor = connection.cursor()
        cursor.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name;"
        )
        tables = [row['table_name'] for row in cursor.fetchall()]
        cursor.close()
        return tables

    def get_table_data(self, connection, instance, table_name):
        if not table_name.isidentifier():
            raise ValueError("Invalid table name")
        cursor = connection.cursor()
        cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position;",
            (table_name,),
        )
        columns = [row['column_name'] for row in cursor.fetchall()]
        cursor.execute(
            """
            SELECT a.attname
            FROM   pg_index i
            JOIN   pg_attribute a ON a.attrelid = i.indrelid
                                 AND a.attnum = ANY(i.indkey)
            WHERE  i.indrelid = %s::regclass
            AND    i.indisprimary;
            """,
            (table_name,),
        )
        primary_keys = [row['attname'] for row in cursor.fetchall()]
        cursor.execute(f'SELECT * FROM "{table_name}" LIMIT 100;')
        rows = cursor.fetchall()
        cursor.close()
        return {"columns": columns, "primary_keys": primary_keys, "rows": rows}

    def execute_query(self, connection, query):
        connection.autocommit = True
        cursor = connection.cursor()
        cursor.execute(query)
        columns = [desc.name for desc in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        cursor.close()
        return {"columns": columns, "rows": rows}

    def close(self, connection):
        if connection:
            connection.close()
