#!/bin/bash
set -e

docker compose \
  --env-file ./app/.env.runtime \
  -p app1 \
  -f ./app/docker-compose-dev.yml \
  run --rm django python manage.py makemigrations