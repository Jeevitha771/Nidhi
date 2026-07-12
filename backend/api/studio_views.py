import os
import subprocess
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.http import FileResponse
from .models import DatabaseInstance
from .permissions import IsFoundingEngineer
from .engine_drivers import get_driver
from .tasks import external_db_migration_task


def _with_connection(instance):
    """Context-manager-free helper: returns (driver, connection)."""
    driver = get_driver(instance.engine)
    return driver, driver.connect(instance.server, instance)


@api_view(['GET'])
@permission_classes([IsFoundingEngineer])
def get_tables(request, instance_id):
    """Retrieve all user tables in the database."""
    instance = get_object_or_404(DatabaseInstance, id=instance_id, is_deleted=False)
    driver, conn = _with_connection(instance)
    try:
        tables = driver.get_tables(conn, instance)
        return Response({"tables": tables}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    finally:
        driver.close(conn)


@api_view(['GET'])
@permission_classes([IsFoundingEngineer])
def get_table_data(request, instance_id, table_name):
    """Retrieve up to 100 rows from a specific table."""
    instance = get_object_or_404(DatabaseInstance, id=instance_id, is_deleted=False)

    if not table_name.isidentifier():
        return Response({"error": "Invalid table name"}, status=status.HTTP_400_BAD_REQUEST)

    driver, conn = _with_connection(instance)
    try:
        data = driver.get_table_data(conn, instance, table_name)
        return Response(data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_ERROR)
    finally:
        driver.close(conn)


@api_view(['POST'])
@permission_classes([IsFoundingEngineer])
def execute_query(request, instance_id):
    """Executes an arbitrary query against the specific database."""
    instance = get_object_or_404(DatabaseInstance, id=instance_id, is_deleted=False)

    query = request.data.get('query')
    if not query:
        return Response({"error": "Query string is required."}, status=status.HTTP_400_BAD_REQUEST)

    driver, conn = _with_connection(instance)
    try:
        result = driver.execute_query(conn, query)
        result["message"] = "Query executed successfully."
        return Response(result, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    finally:
        driver.close(conn)


@api_view(['GET'])
@permission_classes([IsFoundingEngineer])
def download_database_dump(request, instance_id):
    """Generates a dump file for the given instance and returns it as a download."""
    instance = get_object_or_404(DatabaseInstance, id=instance_id, is_deleted=False)
    server = instance.server
    driver = get_driver(instance.engine)

    try:
        if instance.engine == 'cassandra':
            dump_path = os.path.join('/tmp', f"dump_{instance.db_name}")
            driver.backup(server, instance, dump_path)
            # Cassandra backup is a directory; bundle it into a tar.gz for download.
            archive_path = f"{dump_path}.tar.gz"
            subprocess.run(['tar', '-czf', archive_path, '-C', dump_path, '.'], check=True)
            response = FileResponse(
                open(archive_path, 'rb'), as_attachment=True,
                filename=f"{instance.db_name}_backup.tar.gz"
            )
            return response
        else:
            dump_path = os.path.join('/tmp', f"dump_{instance.db_name}.sql")
            driver.backup(server, instance, dump_path)
            response = FileResponse(
                open(dump_path, 'rb'), as_attachment=True,
                filename=f"{instance.db_name}_backup.sql"
            )
            return response
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_ERROR)


@api_view(['POST'])
@permission_classes([IsFoundingEngineer])
def migrate_database(request, instance_id):
    """Triggers an external migration task to pull data into this instance."""
    instance = get_object_or_404(DatabaseInstance, id=instance_id, is_deleted=False)

    source_uri = request.data.get('source_uri')
    if not source_uri:
        return Response({"error": "source_uri is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Trigger Celery task
    external_db_migration_task.delay(instance_id, source_uri)

    return Response({"message": "Migration task started."}, status=status.HTTP_202_ACCEPTED)
