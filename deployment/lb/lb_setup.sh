#!/bin/bash

set -e

DOMAIN="getbetter.ddns.net"
HOSTNAME="lb.getbetter.gg"

echo "===== CONFIGURANDO LOAD BALANCER ====="

echo "[1] Hostname persistente..."
sudo hostnamectl set-hostname $HOSTNAME

sudo sed -i 's/^preserve_hostname: false/preserve_hostname: true/' /etc/cloud/cloud.cfg || true

cat <<EOF | sudo tee /etc/hosts
127.0.0.1 localhost
127.0.1.1 $HOSTNAME lb

::1 localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
EOF

echo "[2] Actualizando sistema..."
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y

echo "[3] Instalando paquetes..."
sudo apt install -y nginx certbot python3-certbot-nginx curl

echo "[4] Limpiando página por defecto..."
sudo rm -f /var/www/html/index.nginx-debian.html

cat <<EOF | sudo tee /var/www/html/index.html
<!DOCTYPE html>
<html>
<head>
<title>LB OK</title>
<style>
body{
font-family:Arial;
background:#111;
color:#0f0;
text-align:center;
padding-top:100px;
}
h1{font-size:48px;}
h2{font-size:28px;}
</style>
</head>
<body>
<h1>Servidor LB funcionando</h1>
<h2>Si estás viendo esto, seguramente hay un problema en la web. ¡Mal admin, mal!</h2>
<p>$DOMAIN</p>
</body>
</html>
EOF

echo "[5] Configurando nginx virtualhost..."

sudo rm -f /etc/nginx/sites-enabled/default

cat <<EOF | sudo tee /etc/nginx/sites-available/getbetter
upstream backend_app {
    server 10.0.0.69;
    server 10.0.0.100;
}

server {
    listen 80;
    listen [::]:80;
    server_name getbetter.ddns.net;

    location / {
        proxy_pass http://backend_app;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;

    }

}
EOF

sudo ln -sf /etc/nginx/sites-available/getbetter /etc/nginx/sites-enabled/getbetter

echo "[6] Validando nginx..."
sudo nginx -t

echo "[7] Reiniciando nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "[8] Validando nginx e instalando certbot..."
sudo nginx -t

sudo certbot --nginx \
-d getbetter.ddns.net \
--non-interactive \
--agree-tos \
-m cgarciap58@iesalbarregas.es \
--redirect

echo "[9] Reiniciando nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx


