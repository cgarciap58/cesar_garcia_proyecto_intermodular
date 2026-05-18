#!/bin/sh
set -e

if [ "${USE_DB:-false}" = "true" ]; then
  echo "Waiting for DB..."
  until nc -z "$DB_HOST" $DB_PORT; do sleep 2; done
fi

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  python manage.py migrate --noinput
fi

echo "Creating superuser if not exists..."

python manage.py shell << EOF
from django.contrib.auth import get_user_model
import os

User = get_user_model()
username = os.environ.get("DJANGO_SUPERUSER_USERNAME")
email = os.environ.get("DJANGO_SUPERUSER_EMAIL")
password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")

if username and not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password)
    print("Superuser created")
else:
    print("Superuser already exists or env missing")
EOF


echo "Collecting static..."
python manage.py collectstatic --noinput

echo "Starting server..."
exec gunicorn core.wsgi:application --bind 0.0.0.0:8000