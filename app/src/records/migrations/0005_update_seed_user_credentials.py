from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import migrations


USER_FIXTURES = (
    ("dev_alex", "developer", "developer", False),
    ("dev_sam", "developer", "developer", False),
    ("lead_morgan", "lead_developer", "lead_developer", True),
)


def update_seed_users(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    Group = apps.get_model("auth", "Group")

    for username, group_name, password, is_staff in USER_FIXTURES:
        user, _ = User.objects.get_or_create(
            username=username,
            defaults={
                "is_active": True,
            },
        )

        user.password = make_password(password)
        user.is_active = True
        user.is_staff = is_staff
        user.save(update_fields=["password", "is_active", "is_staff"])

        group = Group.objects.filter(name=group_name).first()
        if group is not None:
            user.groups.add(group)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("records", "0004_create_developer_seed_users"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(update_seed_users, noop_reverse),
    ]
