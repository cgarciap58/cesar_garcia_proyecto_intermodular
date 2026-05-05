#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

RED_DOCKER="red_docker_proyecto"
ENV_FILE="./app/.local.env"

echo "0. Creando red docker si no existe..."
if ! docker network inspect $RED_DOCKER >/dev/null 2>&1; then
    docker network create $RED_DOCKER
fi

echo "1. Levantando base de datos (MariaDB)"
docker compose \
  --env-file $ENV_FILE \
  -f ./infra-local/docker-compose.yml \
  up -d mariadb

echo "2. Levantando Redis"
docker compose \
  --env-file $ENV_FILE \
  -f ./infra-local/docker-compose.yml \
  up -d redis

echo "3. Levantando App 1"
docker compose \
  -p app1 \
  -f ./app/docker-compose-dev.yml \
  up -d --build

echo "4. Levantando App 2"
docker compose \
  -p app2 \
  -f ./app/docker-compose-dev.yml \
  up -d --build

echo "5. Levantando Load Balancer"
docker compose \
  --env-file $ENV_FILE \
  -f ./infra-local/docker-compose.yml \
  up -d nginx-lb

echo "Todo levantado correctamente"