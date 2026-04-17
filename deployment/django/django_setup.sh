#!/bin/bash

set -e

echo "Actualizando el sistema..."
sudo apt update

echo "Instalando Docker..."
sudo apt install -y docker.io docker-compose

echo "Clonando repositorio..."
git clone https://github.com/cgarciap58/cesar_garcia_proyecto_intermodular
cd cesar_garcia_proyecto_intermodular/app

echo "Inicianlizando contenedor Django..."
docker compose up -d --build

echo "Django arrancado correctamente"