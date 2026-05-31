#!/bin/bash
# =============================================================
# deployment/bastion/bastion_setup.sh
# Uso: bash -s <HOSTNAME>
# =============================================================
set -euo pipefail

if [ $# -ne 1 ]; then
    echo "Uso: $0 <HOSTNAME>"
    exit 1
fi

HOSTNAME="$1"

echo "===== CONFIGURANDO BASTIÓN ($HOSTNAME) ====="

echo "[1] Hostname persistente..."
sudo hostnamectl set-hostname "$HOSTNAME"
sudo sed -i 's/^preserve_hostname: false/preserve_hostname: true/' /etc/cloud/cloud.cfg || true

sudo tee /etc/hosts > /dev/null <<EOF
127.0.0.1 localhost
127.0.1.1 $HOSTNAME $HOSTNAME

::1 localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
EOF

echo "===== BASTIÓN CONFIGURADO ====="