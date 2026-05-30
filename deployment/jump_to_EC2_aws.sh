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

# ------------------------------------------------------------
# Cargar topología AWS (IPs, clave, usuario)
# ------------------------------------------------------------
AWS_MAP="$SCRIPT_DIR/.aws-map.env"

if [[ ! -f "$AWS_MAP" ]]; then
    echo "ERROR: No se encontró $AWS_MAP"
    echo "  Copia deployment/.aws-map.env.example y rellena los valores."
    exit 1
fi

# Cargar ignorando comentarios inline
set -o allexport
source <(grep -v '^\s*#' "$AWS_MAP" | grep -v '^\s*$' | sed 's/[[:space:]]*#.*$//')
set +o allexport

# Resolver KEY_PATH relativo desde la raíz del repo
if [[ "$KEY_PATH" != /* ]]; then
    KEY_PATH="$REPO_ROOT/$KEY_PATH"
fi

: "${KEY_PATH:?KEY_PATH no definida en .aws-map.env}"
: "${BASTION_IP_PUB:?BASTION_IP_PUB no definida en .aws-map.env}"
: "${USUARIO_ROOT_EC2:?USUARIO_ROOT_EC2 no definida en .aws-map.env}"

eval "$(ssh-agent -s)" > /dev/null
ssh-add "$KEY_PATH" 2>/dev/null

# ------------------------------------------------------------
# Menú
# ------------------------------------------------------------
echo ""
echo "¿A qué máquina deseas saltar?"
echo "  0. Bastión"
echo "  1. Load Balancer"
echo "  2. Redis"
echo "  3. Database"
echo "  4. App (elige instancia)"
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
        : "${APP_IP_1:?APP_IP_1 no definida en .aws-map.env}"
        : "${APP_IP_2:?APP_IP_2 no definida en .aws-map.env}"
        echo ""
        echo "  1. App 1  ($APP_IP_1)"
        echo "  2. App 2  ($APP_IP_2)"
        echo ""
        read -rp "--> " app
        case $app in
            1) ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" "${USUARIO_ROOT_EC2}@${APP_IP_1}" ;;
            2) ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" "${USUARIO_ROOT_EC2}@${APP_IP_2}" ;;
            *) echo "Instancia no válida"; exit 1 ;;
        esac
        ;;
    *)
        echo "Máquina no válida"
        exit 1
        ;;
esac
