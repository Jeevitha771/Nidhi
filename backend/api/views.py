# Founding Engineer: Aadisheshu <safacts001@gmail.com>
import os
import requests
import secrets
import string
import subprocess
import tempfile
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import DatabaseServer, Product, DatabaseInstance, DatabaseBackup, EmployeeProductAssignment, StorageBucket
from .serializers import DatabaseServerSerializer, ProductSerializer, DatabaseInstanceSerializer, DatabaseBackupSerializer
from .permissions import IsFoundingEngineer
from django.contrib.auth.models import User
from .authentication import NEXUS_LOCAL_TOKEN

@api_view(['POST'])
@permission_classes([AllowAny])
def sso_callback(request):
    code = request.data.get('code')
    if not code:
        return Response({'error': 'Authorization code is required.'}, status=status.HTTP_400_BAD_REQUEST)
    
    redirect_uri = request.data.get('redirect_uri', 'http://localhost:3000/auth/callback')
    
    token_url = getattr(settings, 'RUBIX_TOKEN_URL', 'https://rubix.novamymentor.cloud/o/token/')
    data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri,
        'client_id': os.environ.get('OAUTH_CLIENT_ID', 'nidhi_client_id_123'),
        'client_secret': os.environ.get('OAUTH_CLIENT_SECRET', 'nidhi_client_secret_xyz789_very_long_string_for_security'),
    }
    
    try:
        response = requests.post(token_url, data=data, timeout=10)
        if response.status_code == 200:
            token_data = response.json()
            return Response({'message': 'SSO Login successful!', 'token': token_data.get('access_token')}, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Failed to exchange token.', 'details': response.json()}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from django.conf import settings
from .engine_drivers import get_driver, default_port_for_engine

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def auto_register_server(request):
    """
    Autonomously register a new VPS node into the Data Plane.
    Protected by NIDHI_REGISTRATION_TOKEN.
    """
    token = request.headers.get('Authorization', '')
    expected_token = f"Bearer {getattr(settings, 'NIDHI_REGISTRATION_TOKEN', 'super_secret_default_token_xyz')}"
    
    if token != expected_token:
        return Response({"error": "Unauthorized registration token"}, status=status.HTTP_401_UNAUTHORIZED)
        
    data = request.data
    engine = data.get('engine', 'postgresql')
    # Default the port to the engine's standard port when not supplied.
    port = data.get('port') or default_port_for_engine(engine)
    # Default the super-user to the engine default (postgres / cassandra).
    root_user = data.get('root_user') or get_driver(engine).root_user_default()
    try:
        server = DatabaseServer.objects.create(
            name=data.get('name', 'Auto-Registered Node'),
            host=data.get('host'),
            engine=engine,
            port=port,
            root_user=root_user,
            root_password=data.get('root_password'),
            environment_type='production',
            is_active=True
        )
        return Response({"message": "Server registered successfully", "id": server.id}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def auto_provision_instance(request):
    """
    Autonomously provisions or retrieves a DB for a startup app via init script.
    Protected by NIDHI_APP_API_KEY.
    """
    token = request.headers.get('Authorization', '')
    expected_token = f"Bearer {getattr(settings, 'NIDHI_APP_API_KEY', 'super_secret_app_api_key_123')}"
    
    if token != expected_token:
        return Response({"error": "Unauthorized API key"}, status=status.HTTP_401_UNAUTHORIZED)
        
    project_slug = request.data.get('project_slug', '').lower().replace(' ', '_')
    environment = request.data.get('environment', 'production').lower()
    engine = request.data.get('engine', 'postgresql')
    
    if not project_slug:
        return Response({"error": "project_slug is required"}, status=status.HTTP_400_BAD_REQUEST)
        
    # Normalize: find existing product case-insensitively
    product = Product.objects.filter(name__iexact=project_slug).first()
    if not product:
        product = Product.objects.create(
            name=project_slug,
            description=f'Auto-created for {project_slug}'
        )
    
    # 2. Check if instance already exists (case-insensitive)
    existing_instance = DatabaseInstance.objects.filter(
        product=product,
        server__environment_type=environment,
        engine=engine,
        is_deleted=False
    ).first()
    
    if existing_instance:
        if existing_instance.status != 'available':
            return Response({"error": "Instance is not yet available"}, status=status.HTTP_400_BAD_REQUEST)
        
        driver = get_driver(existing_instance.engine)
        db_url = driver.build_connection_string(existing_instance.server, existing_instance)
        
        # Match bucket by name convention: {slug}-{environment}-media
        # (more reliable than server-based lookup since buckets can share the same server)
        bucket = StorageBucket.objects.filter(
            product=product,
            bucket_name__endswith="-" + environment + "-media",
            status='available'
        ).first()
        
        response_data = {"database_url": db_url, "engine": existing_instance.engine}
        
        if bucket and bucket.status == 'available':
            response_data["bucket_name"] = bucket.bucket_name
            response_data["bucket_endpoint"] = bucket.endpoint
            response_data["bucket_id"] = str(bucket.id)
            if bucket.access_key and bucket.secret_key:
                response_data["bucket_access_key"] = bucket.access_key
                response_data["bucket_secret_key"] = bucket.secret_key
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    # 3. Find available server for the requested engine + environment
    server = DatabaseServer.objects.filter(
        engine=engine, environment_type=environment, is_active=True
    ).first()
    if not server:
        return Response({"error": f"No active {engine} server found for environment '{environment}'"}, status=status.HTTP_500_INTERNAL_ERROR)
        
    # 4. Provision new database
    db_name = f"{project_slug.replace('-', '_')}_{environment}"[:50]
    db_user = f"{db_name}_user"[:50]
    
    if DatabaseInstance.objects.filter(db_name__iexact=db_name).exists():
        return Response({"error": "Database name conflict"}, status=status.HTTP_409_CONFLICT)
        
    new_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))
    
    instance = DatabaseInstance(
        server=server,
        product=product,
        engine=engine,
        db_name=db_name,
        db_user=db_user,
        db_password_temp=new_password,
        created_by_sso_id='system-auto',
        status='provisioning'
    )
    instance.save()
    
    from .tasks import provision_database_task, provision_bucket_task
    provision_database_task.delay(instance.id)

    bucket_name = f"{project_slug}-{environment}-media"[:63]
    
    # For dev: use local MinIO (server=None), for prod: use VPS MinIO (server=prod_server)
    bucket_server = None
    bucket_endpoint = os.environ.get('PUBLIC_MINIO_ENDPOINT', 'localhost:9000')
    
    if environment == 'production':
        prod_server = DatabaseServer.objects.filter(environment_type='production', is_active=True).first()
        if prod_server:
            bucket_server = prod_server
            bucket_endpoint = f"{prod_server.host}:9000"
    
    MINIO_ROOT_USER = os.environ.get('MINIO_ROOT_USER', 'admin_nidhi_minio')
    MINIO_ROOT_PASSWORD = os.environ.get('MINIO_ROOT_PASSWORD', 'secure_nidhi_minio_password')
    
    bucket, _ = StorageBucket.objects.get_or_create(
        bucket_name=bucket_name,
        defaults={
            'product': product,
            'server': bucket_server,
            'access_key': MINIO_ROOT_USER,
            'secret_key': MINIO_ROOT_PASSWORD,
            'endpoint': bucket_endpoint,
            'created_by_sso_id': 'system-auto',
            'status': 'provisioning',
        }
    )
    if bucket.status == 'provisioning':
        provision_bucket_task.delay(bucket.id)

    driver = get_driver(engine)
    db_url = driver.build_connection_string(server, instance)
    
    # Return bucket credentials if available or provisioning
    bucket_response = {
        "database_url": db_url,
        "engine": engine,
        "bucket_name": bucket_name,
        "bucket_endpoint": bucket.endpoint,
        "bucket_id": str(bucket.id),
    }
    
    # Always include credentials if they are populated
    if bucket.access_key and bucket.secret_key:
        bucket_response["bucket_access_key"] = bucket.access_key
        bucket_response["bucket_secret_key"] = bucket.secret_key
    
    return Response({
        "database_url": db_url,
        **bucket_response,
    }, status=status.HTTP_202_ACCEPTED)

@api_view(['GET', 'POST'])
@permission_classes([IsFoundingEngineer])
def server_list_create(request):
    if request.method == 'GET':
        servers = DatabaseServer.objects.filter(is_active=True)
        serializer = DatabaseServerSerializer(servers, many=True)
        return Response(serializer.data)
    elif request.method == 'POST':
        serializer = DatabaseServerSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def product_list_create(request):
    if request.method == 'GET':
        products = Product.objects.all()
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)
    elif request.method == 'POST':
        serializer = ProductSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def database_instance_list_create(request):
    if request.method == 'GET':
        instances = DatabaseInstance.objects.filter(is_deleted=False).order_by('-created_at')
        if getattr(request.user, 'role', '') != 'founding_engineer':
            assigned_product_ids = EmployeeProductAssignment.objects.filter(
                sso_user_id=request.user.username
            ).values_list('product_id', flat=True)
            instances = instances.filter(product_id__in=assigned_product_ids)
        serializer = DatabaseInstanceSerializer(instances, many=True)
        return Response(serializer.data)
        
    elif request.method == 'POST':
        server_id = request.data.get('server_id')
        product_id = request.data.get('product_id')
        db_name = request.data.get('db_name')
        created_by_sso_id = request.data.get('created_by_sso_id', 'system')
        
        if not server_id or not product_id or not db_name:
            return Response({"error": "server_id, product_id, and db_name are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        server = get_object_or_404(DatabaseServer, id=server_id)
        product = get_object_or_404(Product, id=product_id)
        
        db_user = db_name.replace('-', '_')[:50] + "_user"
        
        if DatabaseInstance.objects.filter(db_name__iexact=db_name).exists():
            return Response({"error": "Database name already exists."}, status=status.HTTP_400_BAD_REQUEST)

        new_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for i in range(16))
        
        instance = DatabaseInstance(
            server=server,
            product=product,
            engine=server.engine,
            db_name=db_name,
            db_user=db_user,
            db_password_temp=new_password,
            created_by_sso_id=created_by_sso_id,
            status='provisioning'
        )
        instance.save()
        
        from .tasks import provision_database_task
        provision_database_task.delay(instance.id)

        serializer = DatabaseInstanceSerializer(instance)
        return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

@api_view(['POST'])
@permission_classes([IsFoundingEngineer])
def delete_database(request, instance_id):
    """Soft Delete: Revokes access on the DB but keeps the data intact."""
    instance = get_object_or_404(DatabaseInstance, id=instance_id, is_deleted=False)
    server = instance.server

    try:
        driver = get_driver(instance.engine)
        driver.delete(server, instance)

        # Soft delete record
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.status = 'stopped'
        instance.save()

        return Response({"message": "Database access revoked and soft deleted successfully.", "engine": instance.engine}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({"error": f"Failed to soft-delete database: {str(e)}"}, status=status.HTTP_500_INTERNAL_ERROR)

@api_view(['GET'])
@permission_classes([IsFoundingEngineer])
def reveal_credentials(request, instance_id):
    instance = get_object_or_404(DatabaseInstance, id=instance_id, is_deleted=False)
    driver = get_driver(instance.engine)
    credentials = {
        "engine": instance.engine,
        "host": instance.server.host,
        "port": instance.server.port,
        "db_name": instance.db_name,
        "db_user": instance.db_user,
        "db_password": instance.db_password_temp,
        "connection_string": driver.build_connection_string(instance.server, instance)
    }
    return Response(credentials, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsFoundingEngineer])
def replicate_to_dev(request, instance_id):
    """Triggers the Celery task to replicate a Prod DB to a Dev server."""
    prod_instance = get_object_or_404(DatabaseInstance, id=instance_id, is_deleted=False)
    
    dev_server_id = request.data.get('dev_server_id')
    new_db_name = request.data.get('new_db_name')
    
    if not dev_server_id or not new_db_name:
        return Response({"error": "dev_server_id and new_db_name are required."}, status=status.HTTP_400_BAD_REQUEST)
        
    from .tasks import replicate_prod_to_dev
    
    # Trigger celery task (engine carried along so target matches source engine)
    replicate_prod_to_dev.delay(prod_instance.id, dev_server_id, new_db_name, prod_instance.engine)
    
    return Response({
        "message": "Replication task triggered successfully.",
        "engine": prod_instance.engine,
        "source_db": prod_instance.db_name,
        "target_db": new_db_name
    }, status=status.HTTP_202_ACCEPTED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response({
        'username': request.user.username,
        'role': getattr(request.user, 'role', 'employee')
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def env_info(request):
    return Response({'environment': os.environ.get('ENVIRONMENT', '')})


@api_view(['POST'])
@permission_classes([AllowAny])
def local_login(request):
    """Local username/password login, only enabled when ENVIRONMENT=nexusserver."""
    if os.environ.get('ENVIRONMENT', '').lower() != 'nexusserver':
        return Response({'error': 'Local login is disabled in this environment.'},
                        status=status.HTTP_403_FORBIDDEN)

    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    if username == 'jeevitha' and password == '123456':
        user, _ = User.objects.get_or_create(username='jeevitha')
        return Response({
            'token': NEXUS_LOCAL_TOKEN,
            'username': 'jeevitha',
            'role': 'founding_engineer',
        })
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alert_list(request):
    from .models import SystemAlert
    from .serializers import SystemAlertSerializer
    alerts = SystemAlert.objects.all().order_by('-created_at')[:50]
    serializer = SystemAlertSerializer(alerts, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def alert_mark_read(request, alert_id):
    from .models import SystemAlert
    try:
        alert = SystemAlert.objects.get(id=alert_id)
        alert.is_read = True
        alert.save()
        return Response({"status": "marked read"}, status=status.HTTP_200_OK)
    except SystemAlert.DoesNotExist:
        return Response({"error": "not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def alert_mark_all_read(request):
    from .models import SystemAlert
    SystemAlert.objects.filter(is_read=False).update(is_read=True)
    return Response({"status": "all marked read"}, status=status.HTTP_200_OK)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def receive_heartbeat(request):
    """
    Receives heartbeat from apps to ensure they are using Nidhi-provisioned databases.
    Protected by NIDHI_APP_API_KEY.
    """
    token = request.headers.get('Authorization', '')
    expected_token = f"Bearer {getattr(settings, 'NIDHI_APP_API_KEY', 'super_secret_app_api_key_123')}"
    
    if token != expected_token:
        return Response({"error": "Unauthorized API key"}, status=status.HTTP_401_UNAUTHORIZED)
        
    project_slug = request.data.get('project_slug')
    environment = request.data.get('environment', 'prod').lower()
    db_url = request.data.get('db_url')
    
    if not all([project_slug, environment, db_url]):
        return Response({"error": "project_slug, environment, and db_url are required"}, status=status.HTTP_400_BAD_REQUEST)
        
    # Check if instance is provisioned
    instance = DatabaseInstance.objects.filter(
        product__name=project_slug,
        server__environment_type=environment,
        is_deleted=False
    ).first()
    
    if not instance:
        logger.warning(f"Heartbeat received for unknown instance: {project_slug} ({environment})")
        return Response({"status": "unknown_instance"}, status=status.HTTP_200_OK)
        
    driver = get_driver(instance.engine)
    expected_db_url = driver.build_connection_string(instance.server, instance)
    
    if db_url != expected_db_url:
        logger.warning(f"Database mismatch for {project_slug} ({environment}). Expected: {expected_db_url}, Received: {db_url}")
        
        # Send Telegram notification
        telegram_bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        telegram_chat_id = os.environ.get('TELEGRAM_CHAT_ID')
        
        if telegram_bot_token and telegram_chat_id:
            message = f"🚨 *Database Mismatch Alert* 🚨\n\n*App:* {project_slug} ({environment})\n*Expected:* {expected_db_url}\n*Actual:* {db_url}"
            telegram_url = f"https://api.telegram.org/bot{telegram_bot_token}/sendMessage"
            payload = {'chat_id': telegram_chat_id, 'text': message, 'parse_mode': 'Markdown'}
            try:
                requests.post(telegram_url, json=payload, timeout=10)
            except Exception as e:
                logger.error(f"Failed to send Telegram notification: {str(e)}")
                
        return Response({"status": "mismatch", "expected": expected_db_url}, status=status.HTTP_200_OK)
        
    return Response({"status": "ok"}, status=status.HTTP_200_OK)
