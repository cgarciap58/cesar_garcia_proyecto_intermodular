#!/bin/bash
set -euo pipefail

if [ $# -ne 2 ]; then
    echo "Uso: $0 <numero_instancia> <ip_privada>"
    exit 1
fi

INSTANCIA=$1
IP=$2
HOSTNAME="app-$INSTANCIA"

echo "===== CONFIGURANDO APP $INSTANCIA ($IP) ====="

echo "[1] Hostname persistente..."
sudo hostnamectl set-hostname $HOSTNAME
sudo sed -i 's/^preserve_hostname: false/preserve_hostname: true/' /etc/cloud/cloud.cfg || true

cat <<EOF | sudo tee /etc/hosts
127.0.0.1 localhost
127.0.1.1 $HOSTNAME app-$INSTANCIA
::1 localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
EOF

echo "[2] Actualizando sistema..."
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y

echo "[3] Instalando Docker y Docker Compose..."

# Instrucciones de instalación de Docker oficiales - Parte 1
sudo apt update
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Instrucciones de instalación de Docker oficiales - Parte 2
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

# Instrucciones de instalación de Docker oficiales - Parte 3
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y

# Instrucciones de instalación de Docker oficiales - Parte 4
sudo systemctl start docker
sudo systemctl status docker

echo "[4] Instalando git..."

sudo apt install git -y

