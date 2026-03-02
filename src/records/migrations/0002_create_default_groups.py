from django.db import migrations


def create_default_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    for group_name in ("basic_user", "developer", "lead_developer"):
        Group.objects.get_or_create(name=group_name)


def remove_default_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name__in=("basic_user", "developer", "lead_developer")).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("records", "0001_initial"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunPython(create_default_groups, remove_default_groups),
    ]
