#!/bin/bash

set -euo pipefail


if [ $# -ne 4 ]; then
    echo "Uso: $0 <REDIS_IP> <APP1_IP> <APP2_IP> <REDIS_PASSWORD>"
    exit 1
fi

REDIS_IP=$1
APP1_IP=$2
APP2_IP=$3
REDIS_PASSWORD=$4

HOST="redis"
HOSTNAME="redis.getbetter.gg"

echo "===== CONFIGURANDO EC2 Redis ====="

echo "[1] Hostname persistente..."
sudo hostnamectl set-hostname $HOSTNAME

sudo sed -i 's/^preserve_hostname: false/preserve_hostname: true/' /etc/cloud/cloud.cfg || true

cat <<EOF | sudo tee /etc/hosts
127.0.0.1 localhost
127.0.1.1 $HOSTNAME $HOST

::1 localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
EOF

echo "[2] Actualizando sistema..."
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y

# ------------------------
# Install Redis
# ------------------------
echo "[3] Instalando Redis..."
sudo apt install -y redis-server

# ------------------------
# Backup config
# ------------------------
sudo cp /etc/redis/redis.conf /etc/redis/redis.conf.bak

# ------------------------
# Redis config
# ------------------------
echo "[4] Configurando Redis..."

sudo sed -i "s/^bind .*/bind 0.0.0.0/" /etc/redis/redis.conf
sudo sed -i 's/^protected-mode .*/protected-mode yes/' /etc/redis/redis.conf
sudo sed -i 's/^port .*/port 6379/' /etc/redis/redis.conf
sudo sed -i 's/^appendonly no/appendonly yes/' /etc/redis/redis.conf
sudo echo "requirepass $REDIS_PASSWORD" >> /etc/redis/redis.conf

# Persistencia AOF
sudo sed -i 's/^appendonly no/appendonly yes/' /etc/redis/redis.conf

# ------------------------
# Restart
# ------------------------
echo "[5] Reiniciando Redis..."
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# ------------------------
# Test
# ------------------------
echo "[6] Validando Redis..."
redis-cli ping

echo "===== REDIS OPERATIVO ====="