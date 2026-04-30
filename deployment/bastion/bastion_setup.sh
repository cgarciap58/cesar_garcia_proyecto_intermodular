#!/bin/bash

set -e

DOMAIN="getbetter.ddns.net"
HOSTNAME="bastion.getbetter.gg"

echo "===== CONFIGURANDO BASTIÓN ====="

echo "[1] Hostname persistente..."
sudo hostnamectl set-hostname $HOSTNAME

sudo sed -i 's/^preserve_hostname: false/preserve_hostname: true/' /etc/cloud/cloud.cfg || true

cat <<EOF | sudo tee /etc/hosts
127.0.0.1 localhost
127.0.1.1 $HOSTNAME bastion

::1 localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
EOF
