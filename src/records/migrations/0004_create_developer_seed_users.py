from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import migrations


USERS_TO_CREATE = (
    ("dev_alex", "developer"),
    ("dev_sam", "developer"),
    ("lead_morgan", "lead_developer"),
)


def create_seed_users(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    Group = apps.get_model("auth", "Group")

    for username, group_name in USERS_TO_CREATE:
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "password": make_password("ChangeMe123!"),
                "is_active": True,
            },
        )
        group = Group.objects.filter(name=group_name).first()
        if group is not None:
            user.groups.add(group)


def remove_seed_users(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    usernames = [username for username, _ in USERS_TO_CREATE]
    User.objects.filter(username__in=usernames).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("records", "0003_ticket"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(create_seed_users, remove_seed_users),
    ]
