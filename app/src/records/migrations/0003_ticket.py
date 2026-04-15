from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('records', '0002_create_default_groups'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Ticket',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('issue', models.TextField()),
                ('assigned_developer', models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name='assigned_tickets', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name='submitted_tickets', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'tickets',
                'ordering': ['-created_at'],
            },
        ),
    ]
