#!/bin/bash

if [ $1 = "v" ]; then
    cd ./infra-local
    docker compose -p app1 -f ./app/docker-compose-dev.yml down -v
    docker compose -p app2 -f ./app/docker-compose-dev.yml down -v
    docker compose down -v
    cd ../app
    docker compose down -v
    cd ..
fi

docker stop $(docker ps -aq) && docker rm $(docker ps -aq)