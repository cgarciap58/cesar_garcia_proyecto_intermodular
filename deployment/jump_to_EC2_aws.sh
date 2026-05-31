#!/bin/bash
# =============================================================
# deployment/jump_to_EC2_aws.sh
#
# Abre una sesión SSH interactiva a cualquier EC2 del proyecto,
# saltando por el bastión.
#
# Uso: ./deployment/jump_to_EC2_aws.sh
#      (o desde cualquier directorio)
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

AWS_MAP="$SCRIPT_DIR/.aws-map.env"

if [[ ! -f "$AWS_MAP" ]]; then
    echo "ERROR: No se encontró $AWS_MAP"
    echo "  Copia deployment/.aws-map.env.example y rellena los valores."
    exit 1
fi

set -o allexport
source <(grep -v '^\s*#' "$AWS_MAP" | grep -v '^\s*$' | sed 's/[[:space:]]*#.*$//')
set +o allexport

if [[ "$KEY_PATH" != /* ]]; then
    KEY_PATH="$REPO_ROOT/$KEY_PATH"
fi

: "${KEY_PATH:?KEY_PATH no definida en .aws-map.env}"
: "${BASTION_IP_PUB:?BASTION_IP_PUB no definida en .aws-map.env}"
: "${USUARIO_ROOT_EC2:?USUARIO_ROOT_EC2 no definida en .aws-map.env}"

eval "$(ssh-agent -s)" > /dev/null
ssh-add "$KEY_PATH" 2>/dev/null

# Recoger todos los APP_IP_* dinámicamente
APP_IPS=()
i=1
while true; do
    varname="APP_IP_${i}"
    ip="${!varname:-}"
    [[ -z "$ip" ]] && break
    APP_IPS+=("$ip")
    (( i++ ))
done

# ------------------------------------------------------------
# Menú
# ------------------------------------------------------------
echo ""
echo "¿A qué máquina deseas saltar?"
echo "  0. Bastión"
echo "  1. Load Balancer"
echo "  2. Redis"
echo "  3. Database"
echo "  4. App (${#APP_IPS[@]} nodo(s))"
echo ""
read -rp "--> " maquina

case $maquina in
    0)
        ssh -A "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}"
        ;;
    1)
        : "${LB_IP:?LB_IP no definida en .aws-map.env}"
        ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" "${USUARIO_ROOT_EC2}@${LB_IP}"
        ;;
    2)
        : "${REDIS_IP:?REDIS_IP no definida en .aws-map.env}"
        ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" "${USUARIO_ROOT_EC2}@${REDIS_IP}"
        ;;
    3)
        : "${DB_IP:?DB_IP no definida en .aws-map.env}"
        ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" "${USUARIO_ROOT_EC2}@${DB_IP}"
        ;;
    4)
        if [[ ${#APP_IPS[@]} -eq 0 ]]; then
            echo "ERROR: No hay ningún APP_IP_* definido en .aws-map.env"
            exit 1
        fi
        echo ""
        for idx in "${!APP_IPS[@]}"; do
            num=$(( idx + 1 ))
            echo "  $num. App $num  (${APP_IPS[$idx]})"
        done
        echo ""
        read -rp "--> " app_num

        if ! [[ "$app_num" =~ ^[0-9]+$ ]] || (( app_num < 1 || app_num > ${#APP_IPS[@]} )); then
            echo "Instancia no válida"
            exit 1
        fi

        IP="${APP_IPS[$((app_num - 1))]}"
        ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" "${USUARIO_ROOT_EC2}@${IP}"
        ;;
    *)
        echo "Máquina no válida"
        exit 1
        ;;
esac