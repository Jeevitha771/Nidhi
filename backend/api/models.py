from django.db import models
import uuid

# Engine choices shared across the control plane. Nidhi currently manages
# PostgreSQL (used by Nexus OMS PRO mode) and Cassandra (used by Nexus OMS for
# high-volume audit/activity storage). The abstraction is open for more engines.
ENGINE_CHOICES = [
    ('postgresql', 'PostgreSQL'),
    ('cassandra', 'Cassandra'),
]

DEFAULT_ENGINE = 'postgresql'

def default_port_for_engine(engine):
    return {'postgresql': 5432, 'cassandra': 9042}.get(engine, 5432)

class DatabaseServer(models.Model):
    """Represents a remote physical server (Dev, Prod VPS) running one DB engine."""
    name = models.CharField(max_length=100, unique=True, help_text="e.g., Prod VPS 1, Dev Server")
    host = models.CharField(max_length=255)
    engine = models.CharField(max_length=50, choices=ENGINE_CHOICES, default=DEFAULT_ENGINE,
                              help_text="Database engine managed on this server")
    port = models.IntegerField(default=5432)
    root_user = models.CharField(max_length=100, default='postgres')
    root_password = models.CharField(max_length=255) # In production, this should be encrypted/vaulted
    environment_type = models.CharField(max_length=50, choices=[('development', 'Development'), ('production', 'Production')])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.engine}, {self.environment_type})"

class Product(models.Model):
    """Represents a startup product/project."""
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class EmployeeProductAssignment(models.Model):
    """Maps an SSO user from Rubix IT to a Product with a specific role."""
    sso_user_id = models.CharField(max_length=255, help_text="The ID or username from Rubix SSO")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='assignments')
    role = models.CharField(max_length=50, choices=[
        ('viewer', 'Viewer'),
        ('developer', 'Developer'),
        ('admin', 'Admin')
    ])
    
    class Meta:
        unique_together = ('sso_user_id', 'product')

    def __str__(self):
        return f"{self.sso_user_id} - {self.product.name} ({self.role})"

class DatabaseInstance(models.Model):
    """A dynamically provisioned database (any supported engine) on a DatabaseServer."""
    STATUS_CHOICES = [
        ('provisioning', 'Provisioning'),
        ('available', 'Available'),
        ('failed', 'Failed'),
        ('stopped', 'Stopped'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    server = models.ForeignKey(DatabaseServer, on_delete=models.PROTECT, related_name='instances')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='databases')
    engine = models.CharField(max_length=50, choices=ENGINE_CHOICES, default=DEFAULT_ENGINE,
                              help_text="Database engine of this instance (inherited from server)")
    
    db_name = models.CharField(max_length=63, unique=True)
    db_user = models.CharField(max_length=63, unique=True)
    db_password_temp = models.CharField(max_length=128, blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='provisioning')
    created_by_sso_id = models.CharField(max_length=255) 
    
    # Critical Data Safety
    is_deleted = models.BooleanField(default=False, help_text="Soft delete flag.")
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.db_name} on {self.server.name} ({'DELETED' if self.is_deleted else self.status})"

class DatabaseBackup(models.Model):
    """Tracks automated pg_dump backups."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = models.ForeignKey(DatabaseInstance, on_delete=models.CASCADE, related_name='backups')
    s3_path = models.CharField(max_length=500, help_text="Path in secure storage")
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=[
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('failed', 'Failed')
    ], default='in_progress')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Backup {self.id} for {self.instance.db_name}"

class StorageBucket(models.Model):
    """An S3-compatible Object Storage bucket provisioned on MinIO."""
    STATUS_CHOICES = [
        ('provisioning', 'Provisioning'),
        ('available', 'Available'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    server = models.ForeignKey(DatabaseServer, on_delete=models.PROTECT, related_name='buckets', null=True, blank=True)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='buckets')
    
    bucket_name = models.CharField(max_length=63, unique=True)
    access_key = models.CharField(max_length=100)
    secret_key = models.CharField(max_length=255)
    endpoint = models.CharField(max_length=255) # e.g. localhost:9000
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='provisioning')
    created_by_sso_id = models.CharField(max_length=255) 
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Bucket {self.bucket_name} ({self.status})"

class SystemAlert(models.Model):
    """System alerts for Nidhi dashboard."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    message = models.TextField()
    level = models.CharField(max_length=50, choices=[
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error')
    ], default='info')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.level.upper()}: {self.title}"
