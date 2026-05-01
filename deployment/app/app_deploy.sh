#!/bin/bash

set -euo pipefail

if [ $# -ne 6 ]; then
    echo "Uso: $0 <DB_HOST> <DB_NAME> <DB_USER> <DB_PASSWORD> <REDIS_HOST> <LB_IP>"
    exit 1
fi

echo $1
echo $2
echo $3
echo $4
echo $5
echo $6


# Este script se encarga de hacer el git clone en caso de que sea necesario, actualizar el repositorio, y re-desplegar la app en producción
# Se lanza después de app_setup.sh, que pone el nombre al host y solo instala las dependencias

repositorio="cesar_garcia_proyecto_intermodular"
ruta_repositorio="https://github.com/cgarciap58/$repositorio.git"
# Verificar si el directorio ya existe, y clonar si no

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
DB_HOST=$1
DB_PORT=3306
DB_NAME=$2
DB_USER=$3
DB_PASSWORD=$4

REDIS_HOST=$5
REDIS_PORT=6379
USE_REDIS=False

DJANGO_SECRET_KEY=xxxxx
DJANGO_DEBUG=True
DB_ENGINE=django.db.backends.mysql

DJANGO_ALLOWED_HOSTS=$6
DJANGO_CSRF_TRUSTED_ORIGINS=https://$6
EOF


echo "[4] Arrancando contenedor Django..."

sudo docker compose down --remove-orphans || true
sudo docker rm -f app2-nginx app1-nginx || true
sudo docker compose up -d --build



# docker compose up -d --build

# echo "Django arrancado correctamente"

echo "Todo correcto, bro"