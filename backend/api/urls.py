from django.urls import path
from . import views
from . import studio_views
from . import bucket_views

urlpatterns = [
    path('instances/auto-provision/', views.auto_provision_instance, name='auto_provision_instance'),
    path('servers/auto-register/', views.auto_register_server, name='auto_register_server'),
    path('servers/', views.server_list_create, name='server_list_create'),
    path('products/', views.product_list_create, name='product_list_create'),
    path('instances/', views.database_instance_list_create, name='database_instance_list_create'),
    path('instances/<uuid:instance_id>/delete/', views.delete_database, name='delete_database'),
    path('instances/<uuid:instance_id>/reveal/', views.reveal_credentials, name='reveal_credentials'),
    path('instances/<uuid:instance_id>/replicate/', views.replicate_to_dev, name='replicate_to_dev'),
    
    # Studio Endpoints
    path('instances/<uuid:instance_id>/studio/tables/', studio_views.get_tables, name='studio_get_tables'),
    path('instances/<uuid:instance_id>/studio/tables/<str:table_name>/', studio_views.get_table_data, name='studio_get_table_data'),
    path('instances/<uuid:instance_id>/studio/query/', studio_views.execute_query, name='studio_execute_query'),
    path('instances/<uuid:instance_id>/studio/download/', studio_views.download_database_dump, name='studio_download_dump'),
    path('instances/<uuid:instance_id>/studio/migrate/', studio_views.migrate_database, name='studio_migrate_database'),

    # Bucket Endpoints
    path('buckets/', bucket_views.list_buckets, name='list_buckets'),
    path('buckets/provision/', bucket_views.provision_bucket, name='provision_bucket'),
    path('buckets/<uuid:bucket_id>/reveal/', bucket_views.reveal_bucket_credentials, name='reveal_bucket_credentials'),
    path('buckets/<uuid:bucket_id>/objects/', bucket_views.list_bucket_objects, name='list_bucket_objects'),
    path('buckets/<uuid:bucket_id>/upload/', bucket_views.upload_object, name='upload_object'),
    path('buckets/<uuid:bucket_id>/delete/', bucket_views.delete_object, name='delete_object'),
    path('buckets/<uuid:bucket_id>/create-folder/', bucket_views.create_folder, name='create_folder'),
    path('buckets/<uuid:bucket_id>/rename/', bucket_views.rename_object, name='rename_object'),
    path('buckets/<uuid:bucket_id>/delete-multiple/', bucket_views.delete_multiple_objects, name='delete_multiple_objects'),

    path('sso/callback/', views.sso_callback, name='sso_callback'),
    path('me/', views.me, name='me'),
    path('env/', views.env_info, name='env_info'),
    path('login/', views.local_login, name='local_login'),

    # Alert Endpoints
    path('alerts/', views.alert_list, name='alert_list'),
    path('alerts/<uuid:alert_id>/read/', views.alert_mark_read, name='alert_mark_read'),
    path('alerts/read-all/', views.alert_mark_all_read, name='alert_mark_all_read'),
]