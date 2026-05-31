#!/bin/bash
# =============================================================
# deployment/lb/lb_update_upstream.sh
#
# Actualiza SOLO el bloque upstream de nginx en un LB ya
# configurado con SSL por certbot. No toca nada más.
#
# Uso: bash -s <APP_IPs_comma> [APP_PORT]
#
# Llamado desde setup_EC2_aws.sh opción "Actualizar upstream LB"
# =============================================================
set -euo pipefail

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    echo "Uso: $0 <APP_IPs_comma> [APP_PORT]"
    exit 1
fi

APP_IPS_CSV="$1"
APP_PORT="${2:-80}"

if [[ -z "$APP_IPS_CSV" ]]; then
    echo "ERROR: No se recibieron IPs de app"
    exit 1
fi

NGINX_CONF="/etc/nginx/sites-available/getbetter"

if [[ ! -f "$NGINX_CONF" ]]; then
    echo "ERROR: No se encontró $NGINX_CONF"
    echo "  Este script es para actualizar un LB ya configurado."
    echo "  Para configurar desde cero usa lb_setup.sh"
    exit 1
fi

echo "===== ACTUALIZANDO UPSTREAM LB ====="
echo "   Nuevas IPs : $APP_IPS_CSV"
echo "   Puerto app : $APP_PORT"
echo ""

# Construir el nuevo bloque upstream
UPSTREAM_BLOCK="upstream backend_app {"$'\n'
UPSTREAM_BLOCK+="    least_conn;"$'\n'
IFS=',' read -ra IPS <<< "$APP_IPS_CSV"
for ip in "${IPS[@]}"; do
    ip="${ip// /}"
    UPSTREAM_BLOCK+="    server ${ip}:${APP_PORT} max_fails=2 fail_timeout=10s;"$'\n'
done
UPSTREAM_BLOCK+="}"

# Backup de seguridad antes de tocar nada
sudo cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%Y%m%d_%H%M%S)"
echo "   Backup guardado en ${NGINX_CONF}.bak.*"

# Reemplazar el bloque upstream usando awk:
# Borra desde "upstream backend_app {" hasta el "}" de cierre,
# e inyecta el nuevo bloque en su lugar. El resto del fichero
# (server blocks, SSL config de certbot) queda intacto.
TMPFILE=$(mktemp)

awk -v new_upstream="$UPSTREAM_BLOCK" '
    /^upstream backend_app \{/ { in_upstream=1 }
    in_upstream {
        if (/^\}/) {
            print new_upstream
            in_upstream=0
        }
        next
    }
    { print }
' "$NGINX_CONF" > "$TMPFILE"

sudo cp "$TMPFILE" "$NGINX_CONF"
rm -f "$TMPFILE"

echo ""
echo "   Nuevo upstream:"
for ip in "${IPS[@]}"; do
    echo "     - ${ip// /}:${APP_PORT}"
done
echo ""

echo ">> Validando nginx..."
sudo nginx -t

echo ">> Recargando nginx (sin downtime)..."
sudo systemctl reload nginx

echo ""
echo "===== UPSTREAM ACTUALIZADO ====="