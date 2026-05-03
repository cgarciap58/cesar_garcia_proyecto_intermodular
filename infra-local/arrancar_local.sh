#!/bin/bash

if [ "$(pwd)" != "/home/cgarciap/01.ASIR2/10.Proyecto_intermodular/proyecto_final" ]; then
    cd /home/cgarciap/01.ASIR2/10.Proyecto_intermodular/proyecto_final
fi

red_docker="red_docker_proyecto"

if docker network inspect $red_docker >/dev/null 2>&1; then
    echo "Red existe"
else
    docker network create $red_docker
fi

echo "1. Levantando simulación de servicios local (Base de datos)"

docker compose --env-file ./app/.env.local -f ./infra-local/docker-compose.yml up -d mariadb

echo "2. Levantando simulación de servicios local (Redis)"

docker compose --env-file ./app/.env.local -f ./infra-local/docker-compose.yml up -d redis

echo "3. Levantando Apps local"

docker compose -p app1 -f ./app/docker-compose.yml -f ./app/docker-compose.dev.yml up -d
docker compose -p app2 -f ./app/docker-compose.yml -f ./app/docker-compose.dev.yml up -d

echo "4. Levantando simulación de servicios local (Load Balancer)"

docker compose --env-file ./app/.env.local -f ./infra-local/docker-compose.yml up  -d nginx-lb

