#!/bin/bash

set -e

echo "Actualizando el sistema..."
sudo apt update

echo "Instalando Redis..."
sudo apt install -y redis-server

echo "Configurando Redis para permitir conexiones externas..."
sudo sed -i 's/^bind .*/bind 0.0.0.0/' /etc/redis/redis.conf # Permite conexiones desde cualquier IP TODO: restringir a las IPs de los EC2 de Django
sudo sed -i 's/^protected-mode yes/protected-mode no/' /etc/redis/redis.conf # Desactiva el modo protegido

echo "Reiniciando Redis..."
sudo systemctl restart redis
sudo systemctl enable redis

echo "Redis configurado correctamente"