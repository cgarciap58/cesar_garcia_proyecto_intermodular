#!/bin/bash

if [ $1 = "v" ]; then
    cd ./infra-local
    docker compose down -v
    cd ../app
    docker compose down -v
    cd ..
fi

docker stop $(docker ps -aq) && docker rm $(docker ps -aq)