#!/bin/bash

set -euo pipefail

if [ $# -ne 10 ]; then
    echo "Uso: $0 <DB_HOST> <DB_NAME> <DB_USER> <DB_PASSWORD> <REDIS_HOST> <LB_IP>"
    exit 1
fi

DB_IP=$1
REDIS_IP=$2
LB_IP=$3
DB_USER=$4
DB_PASS=$5
DB_NAME=$6
DJANGO_SUPERUSER_USERNAME=$7
DJANGO_SUPERUSER_EMAIL=$8
DJANGO_SUPERUSER_PASSWORD=$9
DOMAIN=${10}

echo "DB_IP: $DB_IP"
echo "REDIS_IP: $REDIS_IP"
echo "LB_IP: $LB_IP"
echo "DB_USER: $DB_USER"
echo "DB_PASS: $DB_PASS"
echo "DB_NAME: $DB_NAME"


# Este script se encarga de hacer el git clone en caso de que sea necesario, actualizar el repositorio, y re-desplegar la app en producción
# Se lanza después de app_setup.sh, que pone el nombre al host y solo instala las dependencias

repositorio="cesar_garcia_proyecto_intermodular"
ruta_repositorio="https://github.com/cgarciap58/$repositorio.git"
# Verificar si el directorio ya existe, y clonar si no


echo "[0] Forzando estado limpio del repositorio..."

cd ~

rm -rf "$repositorio"

echo "[1] Clonando repositorio..."
git clone "$ruta_repositorio"

cd "$repositorio"


cd ~

if [ -d "$repositorio" ]; then
    echo "whoami: $(whoami)"
    echo "pwd: $(pwd)"
    ls -la
    echo "[1] El directorio ya existe, actualizando repositorio..."
    cd $repositorio
    git pull
else
    echo "[1] Clonando repositorio..."
    git clone $ruta_repositorio
    cd $repositorio
fi

echo "[2] Limpiando directorios innecesarios..."
ls -la
rm -rf ./deployment ./docs ./infra-local
ls -la
cd ./app

echo "[3] Creando .env.aws"
cat > .env.aws <<EOF
DB_HOST=$DB_IP
DB_PORT=3306
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS

REDIS_HOST=$REDIS_IP
REDIS_PORT=6379
USE_REDIS=True

DJANGO_SECRET_KEY=xxxxx
DJANGO_DEBUG=True
DB_ENGINE=django.db.backends.mysql

DJANGO_SUPERUSER_USERNAME=$DJANGO_SUPERUSER_USERNAME
DJANGO_SUPERUSER_EMAIL=$DJANGO_SUPERUSER_EMAIL
DJANGO_SUPERUSER_PASSWORD=$DJANGO_SUPERUSER_PASSWORD

DJANGO_ALLOWED_HOSTS=$LB_IP,localhost,127.0.0.1,$DOMAIN
DJANGO_CSRF_TRUSTED_ORIGINS=https://$LB_IP,https://$DOMAIN
EOF


echo "[4] Arrancando contenedor Django..."

sudo docker compose down --remove-orphans || true
sudo docker rm -f app2-nginx app1-nginx || true
sudo docker compose -f docker-compose.yml up -d --build



# docker compose up -d --build

# echo "Django arrancado correctamente"

echo "Todo correcto, bro"