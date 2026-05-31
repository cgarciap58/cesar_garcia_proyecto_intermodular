#!/bin/bash
# =============================================================
# deployment/lb/lb_setup.sh
# Uso: bash -s <HOSTNAME> <DOMAIN> <APP_IPs_comma> [APP_PORT]
# =============================================================
set -euo pipefail

if [ $# -lt 3 ] || [ $# -gt 4 ]; then
    echo "Uso: $0 <HOSTNAME> <DOMAIN> <APP_IPs_comma> [APP_PORT]"
    exit 1
fi

HOSTNAME="$1"
DOMAIN="$2"
APP_IPS_CSV="$3"
APP_PORT="${4:-80}"

if [[ -z "$APP_IPS_CSV" ]]; then echo "ERROR: No se recibieron IPs de app"; exit 1; fi

echo "===== CONFIGURANDO LOAD BALANCER ($HOSTNAME) ====="
echo "   Dominio   : $DOMAIN"
echo "   App nodes : $APP_IPS_CSV"
echo "   App port  : $APP_PORT"

echo "[1] Hostname persistente..."
sudo hostnamectl set-hostname "$HOSTNAME"
sudo sed -i 's/^preserve_hostname: false/preserve_hostname: true/' /etc/cloud/cloud.cfg || true

sudo tee /etc/hosts > /dev/null <<HOSTS
127.0.0.1 localhost
127.0.1.1 $HOSTNAME $HOSTNAME
::1 localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
HOSTS

echo "[2] Actualizando sistema..."
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y

echo "[3] Instalando paquetes..."
sudo apt install -y nginx certbot python3-certbot-nginx curl

echo "[4] Limpiando configuración por defecto..."
sudo rm -f /var/www/html/index.nginx-debian.html
sudo rm -f /etc/nginx/sites-enabled/default

echo "[5] Generando configuración nginx..."

UPSTREAM_SERVERS=""
IFS=',' read -ra IPS <<< "$APP_IPS_CSV"
for ip in "${IPS[@]}"; do
    ip="${ip// /}"
    UPSTREAM_SERVERS+="    server ${ip}:${APP_PORT} max_fails=2 fail_timeout=10s;"$'\n'
done

sudo tee /etc/nginx/sites-available/getbetter > /dev/null <<NGINX
upstream backend_app {
    least_conn;

${UPSTREAM_SERVERS}
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://backend_app;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;

        proxy_connect_timeout 1s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;

        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503 http_504;
        proxy_next_upstream_tries 2;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/getbetter /etc/nginx/sites-enabled/getbetter

echo "[6] Validando nginx..."
sudo nginx -t

echo "[7] Reiniciando nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "[8] Instalando certificado SSL (certbot)..."
sudo certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    -m cgarciap58@iesalbarregas.es \
    --redirect

echo "[9] Reiniciando nginx con SSL..."
sudo systemctl restart nginx

echo ""
echo "===== LOAD BALANCER CONFIGURADO ====="
echo "   Nodos en upstream:"
for ip in "${IPS[@]}"; do
    echo "     - ${ip// /}:${APP_PORT}"
done
echo ""