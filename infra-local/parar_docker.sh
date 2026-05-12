#!/bin/bash

docker compose down -v

docker stop $(docker ps -aq) && docker rm $(docker ps -aq)