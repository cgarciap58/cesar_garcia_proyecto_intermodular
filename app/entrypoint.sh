#!/bin/sh
set -e

echo "Aplicando migraciones Django..."
python manage.py migrate --noinput

# if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
#   echo "Asegurando que el superusuario exista..."
#   python manage.py shell -c "import os; from django.contrib.auth import get_user_model; User = get_user_model(); username = os.environ['DJANGO_SUPERUSER_USERNAME']; email = os.environ['DJANGO_SUPERUSER_EMAIL']; password = os.environ['DJANGO_SUPERUSER_PASSWORD']; user = User.objects.filter(username=username).first(); print('superuser already exists') if user else (User.objects.create_superuser(username=username, email=email, password=password) and print('superuser created'))"
# else
#   echo "Evitamos creación de superusuario Django, asegúrate que las variables de entorno DJANGO_SUPERUSER_USERNAME, DJANGO_SUPERUSER_EMAIL y DJANGO_SUPERUSER_PASSWORD están configuradas."
# fi

echo "Recogiendo archivos estáticos..."
python manage.py collectstatic --noinput

echo "Lanzando Gunicorn..."
exec "$@"

