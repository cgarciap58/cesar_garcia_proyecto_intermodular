#!/bin/bash

docker compose -p app1 restart django
docker compose -p app2 restart django