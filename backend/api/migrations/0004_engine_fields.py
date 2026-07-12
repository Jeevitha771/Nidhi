# Multi-engine support: add `engine` to DatabaseServer and DatabaseInstance.
# Generated manually (Django not installed in the build env). Apply with:
#   python manage.py migrate api

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_storagebucket_server'),
    ]

    operations = [
        migrations.AddField(
            model_name='databaseserver',
            name='engine',
            field=models.CharField(
                choices=[('postgresql', 'PostgreSQL'), ('cassandra', 'Cassandra')],
                default='postgresql',
                help_text='Database engine managed on this server',
                max_length=50,
            ),
        ),
        migrations.AddField(
            model_name='databaseinstance',
            name='engine',
            field=models.CharField(
                choices=[('postgresql', 'PostgreSQL'), ('cassandra', 'Cassandra')],
                default='postgresql',
                help_text='Database engine of this instance (inherited from server)',
                max_length=50,
            ),
        ),
    ]
