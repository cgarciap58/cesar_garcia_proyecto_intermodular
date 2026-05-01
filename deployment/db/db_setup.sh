#!/bin/bash
set -euo pipefail

if [ $# -ne 4 ]; then
    echo "Uso: $0 <django_db_user> <django_db_pass> <django_db_database_name> <django_app_ec2_ips>"
    exit 1
fi

django_db_user="$1"
django_db_pass="$2"
django_db_database_name="$3"
django_EC2_IPs="$4"


HOST="db"
HOSTNAME="db.getbetter.gg"

echo "===== CONFIGURANDO BASE DE DATOS ====="

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

echo "[3] Instalando MariaDB..."
sudo apt install -y mariadb-server
unset TMPDIR
sudo mysql_install_db

sudo systemctl enable mariadb
sudo systemctl start mariadb

echo "[4] Creando base de datos..."

sudo mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS ${django_db_database_name};
EOF

echo "[5] Creando usuarios para instancias Django..."

IFS=',' read -ra django_IPS <<< "$django_EC2_IPs"

for ip in "${django_IPS[@]}"; do
sudo mysql <<EOF
CREATE USER IF NOT EXISTS '${django_db_user}'@'${ip}' IDENTIFIED BY '${django_db_pass}';
GRANT ALL PRIVILEGES ON ${django_db_database_name}.* TO '${django_db_user}'@'${ip}';
FLUSH PRIVILEGES;
EOF
done

echo "[6] Configurando MariaDB para aceptar conexiones remotas..."

sudo sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf
sudo systemctl restart mariadb

sleep 2

echo "[7] Éxito, ¡base de datos configurada correctamente!"
sudo systemctl status mariadb
