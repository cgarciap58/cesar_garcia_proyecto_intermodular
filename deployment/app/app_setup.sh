#!/bin/bash

set -e

echo "Actualizando el sistema..."
sudo apt update
sudo apt upgrade -y


if [ $# -ne 1 ]; then
    echo "Uso: $0 <numero_instancia>"
    exit 1
fi

instacia_app=$1
DOMAIN="getbetter.ddns.net" # Necesario?
HOSTNAME="app-$instacia_app"

case $instacia_app in
    1)
        IP="10.0.0.69"
        ;;
    2)
        IP="10.0.0.100"
        ;;
    *)
        echo "Número de instancia no válido"
        exit 1
        ;;
esac

# Actualización de nombre
echo "===== CONFIGURANDO APP $instacia_app ====="

echo "[1] Hostname persistente..."
sudo hostnamectl set-hostname $HOSTNAME

sudo sed -i 's/^preserve_hostname: false/preserve_hostname: true/' /etc/cloud/cloud.cfg || true

cat <<EOF | sudo tee /etc/hosts
127.0.0.1 localhost
127.0.1.1 $HOSTNAME app-$instacia_app

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

# Instrucciones de instalación de Docker oficiales - Verificación
# sudo docker run hello-world

# Creación del HTML de prueba en docker

echo "[4] Creando un index.html de prueba..."


# if [ ! -d ~/app$instacia_app ]; then
# mkdir ~/app$instacia_app
# fi

# cd ~/app$instacia_app

# if [ ! -d "html" ]; then
#     mkdir html
# fi

mkdir -p html
cat <<EOF | sudo tee html/index.html

<!DOCTYPE html>
<html>
<head>
<title>APP $instacia_app</title>
<style>
body{
background:#111;
color:#00ff00;
font-family:Arial;
text-align:center;
padding-top:100px;
}
</style>
</head>
<body>
<h1>APP $instacia_app NODE</h1>
<h2>$IP</h2>
Si estás viendo esto, ha habido un error y Django no se está mostrando. ¡Mal admin, mal!
</body>
</html>
EOF

# cat <<EOF | sudo tee compose.yml
# services:
#   nginx:
#     image: nginx:latest
#     container_name: app$instacia_app-nginx
#     ports:
#       - "80:80"
#     volumes:
#       - ./html:/usr/share/nginx/html:ro
#     restart: unless-stopped
# EOF

echo "[5] Instalando git..."

sudo apt install git -y

sudo docker compose up -d


# echo "Clonando repositorio..."
# git clone https://github.com/cgarciap58/cesar_garcia_proyecto_intermodular
# cd cesar_garcia_proyecto_intermodular/app

# echo "Inicianlizando contenedor Django..."

# curl -fsSL https://tailscale.com/install.sh | sh # Reemplazar por la clave de autenticación de Tailscale
# tailscale up --authkey=TSKEY \ 
#  --hostname=app-03 \ 
#  --accept-dns=false

# docker compose up -d --build

# echo "Django arrancado correctamente"

echo "Todo correcto, bro"