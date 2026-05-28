#!/bin/bash

set -euo pipefail

if [ $# -ne 0 ]; then
    echo "Uso: $0"
    exit 1
fi

# Este script se encarga de hacer el git clone en caso de que sea necesario, actualizar el repositorio, y re-desplegar la app en producción
# Se lanza después de app_setup.sh, que pone el nombre al host y solo instala las dependencias
# Es lanzado  por setup_EC2_aws.sh, que deja el archivo .env.runtime con las variables de entorno necesarias en /tmp

repositorio="cesar_garcia_proyecto_intermodular"
ruta_repositorio="https://github.com/cgarciap58/$repositorio.git"

echo "[1] Gestionando repositorio..."

if [ ! -d "$repositorio" ]; then
    echo "Clonando repositorio..."
    git clone "$ruta_repositorio"
fi

cd "$repositorio"
git pull

echo "[2] Limpiando directorios innecesarios..."
ls -la
rm -rf ./deployment ./docs ./infra-local
ls -la
cd ./app


echo "[3] Rescatando .env.runtime"

if [ ! -f /tmp/.env.runtime ]; then
    echo "ERROR: .env.runtime no encontrado"
    exit 1
fi

cp /tmp/.env.runtime ./.env.runtime


echo "[4] Arrancando contenedor Django..."
sudo docker compose -f docker-compose.yml down --remove-orphans || true
sudo docker image prune -f
sudo docker compose -f docker-compose.yml up -d --build

echo "Docker Compose lanzado correctamente. Actualizado al repositorio actual"