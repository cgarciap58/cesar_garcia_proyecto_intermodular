#!/bin/bash
# =============================================================
# deployment/setup_EC2_aws.sh
#
# Inicializa o despliega cualquier EC2 del proyecto saltando
# por el bastión.
#
# Uso: ./deployment/setup_EC2_aws.sh
#      (o desde cualquier directorio)
# =============================================================

set -euo pipefail

if [ $# -ne 0 ]; then
    echo "Este script no acepta parámetros."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ------------------------------------------------------------
# Cargar topología AWS
# ------------------------------------------------------------
AWS_MAP="$SCRIPT_DIR/.aws-map.env"

if [[ ! -f "$AWS_MAP" ]]; then
    echo "ERROR: No se encontró $AWS_MAP"
    echo "  Copia deployment/.aws-map.env.example y rellena los valores."
    exit 1
fi

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
# Menú principal
# ------------------------------------------------------------
echo ""
echo "ADVERTENCIA: Esta operación puede ser destructiva."
echo "¿Qué instancia quieres configurar o desplegar?"
echo "  0. Bastion"
echo "  1. Load Balancer"
echo "  2. DB"
echo "  3. Redis"
echo "  4. Apps"
echo ""
read -rp "--> " maquina

case $maquina in

    # ---- Bastion ----
    0)
        ssh -A "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
            'bash -s' < "$SCRIPT_DIR/bastion/bastion_setup.sh"
        ;;

    # ---- Load Balancer ----
    1)
        : "${LB_IP:?LB_IP no definida en .aws-map.env}"
        ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
            "${USUARIO_ROOT_EC2}@${LB_IP}" \
            'bash -s' < "$SCRIPT_DIR/lb/lb_setup.sh"
        ;;

    # ---- Base de datos ----
    2)
        : "${DB_IP:?DB_IP no definida en .aws-map.env}"
        : "${APP_IP_1:?APP_IP_1 no definida en .aws-map.env}"
        : "${APP_IP_2:?APP_IP_2 no definida en .aws-map.env}"

        DJANGO_APP_EC2_IPS="$APP_IP_1,$APP_IP_2"

        # Cargar variables de app para pasar credenciales DB
        set -o allexport
        source <(grep -v '^\s*#' "$REPO_ROOT/app/.app.aws.env" | grep -v '^\s*$' | sed 's/[[:space:]]*#.*$//')
        set +o allexport

        ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
            "${USUARIO_ROOT_EC2}@${DB_IP}" \
            "bash -s -- $DJANGO_DB_USER $DJANGO_DB_PASS $DJANGO_DB_NAME $DJANGO_APP_EC2_IPS" \
            < "$SCRIPT_DIR/db/db_setup.sh"
        ;;

    # ---- Redis ----
    3)
        : "${REDIS_IP:?REDIS_IP no definida en .aws-map.env}"
        : "${APP_IP_1:?APP_IP_1 no definida en .aws-map.env}"
        : "${APP_IP_2:?APP_IP_2 no definida en .aws-map.env}"

        # Cargar REDIS_PASS desde base env
        set -o allexport
        source <(grep -v '^\s*#' "$REPO_ROOT/app/.app.base.env" | grep -v '^\s*$' | sed 's/[[:space:]]*#.*$//')
        set +o allexport

        ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
            "${USUARIO_ROOT_EC2}@${REDIS_IP}" \
            "bash -s -- $REDIS_IP $APP_IP_1 $APP_IP_2 $REDIS_PASS" \
            < "$SCRIPT_DIR/redis/redis_setup.sh"
        ;;

    # ---- Apps ----
    4)
        : "${APP_IP_1:?APP_IP_1 no definida en .aws-map.env}"
        : "${APP_IP_2:?APP_IP_2 no definida en .aws-map.env}"
        : "${LB_IP:?LB_IP no definida en .aws-map.env}"
        : "${DB_IP:?DB_IP no definida en .aws-map.env}"
        : "${REDIS_IP:?REDIS_IP no definida en .aws-map.env}"
        : "${DOMAIN:?DOMAIN no definida en .aws-map.env}"

        echo ""
        echo "  1. App 1  ($APP_IP_1)"
        echo "  2. App 2  ($APP_IP_2)"
        echo ""
        read -rp "--> " app

        case $app in
            1) IP=$APP_IP_1 ;;
            2) IP=$APP_IP_2 ;;
            *) echo "Instancia no válida"; exit 1 ;;
        esac

        echo ""
        echo "  1. Inicializar / setup"
        echo "  2. Desplegar / deploy  (no hay vuelta atrás)"
        echo ""
        read -rp "--> " opcion

        case $opcion in
            1)
                ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
                    "${USUARIO_ROOT_EC2}@${IP}" \
                    "bash -s $app $IP" \
                    < "$SCRIPT_DIR/app/app_setup.sh"
                ;;
            2)
                # Construir .env.runtime y enviarlo a la instancia
                RUNTIME_ENV=$(mktemp)
                trap "rm -f $RUNTIME_ENV" EXIT

                cat "$REPO_ROOT/app/.app.base.env" > "$RUNTIME_ENV"
                cat "$REPO_ROOT/app/.app.aws.env"  >> "$RUNTIME_ENV"

                echo "DB_HOST=$DB_IP"                          >> "$RUNTIME_ENV"
                echo "REDIS_HOST=$REDIS_IP"                    >> "$RUNTIME_ENV"
                echo "DJANGO_ALLOWED_HOSTS=$LB_IP,$DOMAIN"    >> "$RUNTIME_ENV"

                scp -o "ProxyJump=${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
                    "$RUNTIME_ENV" \
                    "${USUARIO_ROOT_EC2}@${IP}:/tmp/.env.runtime"

                ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
                    "${USUARIO_ROOT_EC2}@${IP}" \
                    'bash -s' < "$SCRIPT_DIR/app/app_deploy.sh"
                ;;
            *)
                echo "Opción no válida"
                exit 1
                ;;
        esac
        ;;

    *)
        echo "Máquina no válida"
        exit 1
        ;;
esac
