#!/bin/bash
# =============================================================
# deployment/setup_EC2_aws.sh
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

if [[ "$KEY_PATH" != /* ]]; then
    KEY_PATH="$REPO_ROOT/$KEY_PATH"
fi

if [[ -z "${KEY_PATH:-}" ]];           then echo "ERROR: KEY_PATH no definida en .aws-map.env";           exit 1; fi
if [[ -z "${BASTION_IP_PUB:-}" ]];     then echo "ERROR: BASTION_IP_PUB no definida en .aws-map.env";     exit 1; fi
if [[ -z "${USUARIO_ROOT_EC2:-}" ]];   then echo "ERROR: USUARIO_ROOT_EC2 no definida en .aws-map.env";   exit 1; fi

eval "$(ssh-agent -s)" > /dev/null
ssh-add "$KEY_PATH" 2>/dev/null

# ------------------------------------------------------------
# Recoger todos los APP_IP_* dinámicamente
# ------------------------------------------------------------
APP_IPS=()
i=1
while true; do
    varname="APP_IP_${i}"
    ip="${!varname:-}"
    [[ -z "$ip" ]] && break
    APP_IPS+=("$ip")
    (( i++ ))
done

if [[ ${#APP_IPS[@]} -eq 0 ]]; then
    echo "ERROR: No se encontró ningún APP_IP_* en .aws-map.env"
    exit 1
fi

APP_IPS_CSV=$(IFS=','; echo "${APP_IPS[*]}")

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
echo "  4. Apps  (${#APP_IPS[@]} nodo(s) detectado(s))"
echo ""
read -rp "--> " maquina

case $maquina in

    0)
        if [[ -z "${BASTION_HOSTNAME:-}" ]]; then echo "ERROR: BASTION_HOSTNAME no definida en .aws-map.env"; exit 1; fi
        ssh -A "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
            "bash -s -- $BASTION_HOSTNAME" \
            < "$SCRIPT_DIR/bastion/bastion_setup.sh"
        ;;

    1)
        if [[ -z "${LB_IP:-}" ]];       then echo "ERROR: LB_IP no definida en .aws-map.env";       exit 1; fi
        if [[ -z "${LB_HOSTNAME:-}" ]]; then echo "ERROR: LB_HOSTNAME no definida en .aws-map.env"; exit 1; fi
        if [[ -z "${DOMAIN:-}" ]];      then echo "ERROR: DOMAIN no definida en .aws-map.env";      exit 1; fi

        echo ""
        echo "  1. Setup completo  (máquina nueva, instala nginx + certbot)"
        echo "  2. Actualizar upstream  (ya tiene SSL, solo cambia las IPs de app)"
        echo ""
        read -rp "--> " lb_opcion

        if [[ "$lb_opcion" == "1" ]]; then
            ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
                "${USUARIO_ROOT_EC2}@${LB_IP}" \
                "bash -s -- $LB_HOSTNAME $DOMAIN $APP_IPS_CSV" \
                < "$SCRIPT_DIR/lb/lb_setup.sh"
        elif [[ "$lb_opcion" == "2" ]]; then
            ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
                "${USUARIO_ROOT_EC2}@${LB_IP}" \
                "bash -s -- $APP_IPS_CSV" \
                < "$SCRIPT_DIR/lb/update_lb.sh"
        else
            echo "Opción no válida"
            exit 1
        fi
        ;;

    2)
        if [[ -z "${DB_IP:-}" ]];       then echo "ERROR: DB_IP no definida en .aws-map.env";       exit 1; fi
        if [[ -z "${DB_HOSTNAME:-}" ]]; then echo "ERROR: DB_HOSTNAME no definida en .aws-map.env"; exit 1; fi

        set -o allexport
        source <(grep -v '^\s*#' "$REPO_ROOT/app/.app.aws.env" | grep -v '^\s*$' | sed 's/[[:space:]]*#.*$//')
        set +o allexport

        ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
            "${USUARIO_ROOT_EC2}@${DB_IP}" \
            "bash -s -- $DB_HOSTNAME $DJANGO_DB_USER $DJANGO_DB_PASS $DJANGO_DB_NAME $APP_IPS_CSV" \
            < "$SCRIPT_DIR/db/db_setup.sh"
        ;;

    3)
        if [[ -z "${REDIS_IP:-}" ]];       then echo "ERROR: REDIS_IP no definida en .aws-map.env";       exit 1; fi
        if [[ -z "${REDIS_HOSTNAME:-}" ]]; then echo "ERROR: REDIS_HOSTNAME no definida en .aws-map.env"; exit 1; fi

        set -o allexport
        source <(grep -v '^\s*#' "$REPO_ROOT/app/.app.base.env" | grep -v '^\s*$' | sed 's/[[:space:]]*#.*$//')
        set +o allexport

        ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
            "${USUARIO_ROOT_EC2}@${REDIS_IP}" \
            "bash -s -- $REDIS_HOSTNAME $REDIS_IP $APP_IPS_CSV $REDIS_PASS" \
            < "$SCRIPT_DIR/redis/redis_setup.sh"
        ;;

    4)
        if [[ -z "${APP_BASE_HOSTNAME:-}" ]]; then echo "ERROR: APP_BASE_HOSTNAME no definida en .aws-map.env"; exit 1; fi
        if [[ -z "${LB_IP:-}" ]];             then echo "ERROR: LB_IP no definida en .aws-map.env";             exit 1; fi
        if [[ -z "${DB_IP:-}" ]];             then echo "ERROR: DB_IP no definida en .aws-map.env";             exit 1; fi
        if [[ -z "${REDIS_IP:-}" ]];          then echo "ERROR: REDIS_IP no definida en .aws-map.env";          exit 1; fi
        if [[ -z "${DOMAIN:-}" ]];            then echo "ERROR: DOMAIN no definida en .aws-map.env";            exit 1; fi

        echo ""
        echo "Nodos disponibles:"
        # Por cada nodo en el array, escribe "App + número + IP"
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
        BASE_DOMAIN="${APP_BASE_HOSTNAME#*.}"
        NODE_HOSTNAME="app-${app_num}.${BASE_DOMAIN}"

        echo ""
        echo "  Nodo    : $NODE_HOSTNAME ($IP)"
        echo "  1. Inicializar / setup"
        echo "  2. Desplegar / deploy  (no hay vuelta atrás)"
        echo ""
        read -rp "--> " opcion

        case $opcion in
            1)
                ssh -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
                    "${USUARIO_ROOT_EC2}@${IP}" \
                    "bash -s -- $NODE_HOSTNAME $IP" \
                    < "$SCRIPT_DIR/app/app_setup.sh"
                ;;
            2)
                RUNTIME_ENV=$(mktemp)
                trap "rm -f $RUNTIME_ENV" EXIT

                cat "$REPO_ROOT/app/.app.base.env" > "$RUNTIME_ENV"
                cat "$REPO_ROOT/app/.app.aws.env"  >> "$RUNTIME_ENV"
                echo "DB_HOST=$DB_IP"                      >> "$RUNTIME_ENV"
                echo "REDIS_HOST=$REDIS_IP"                >> "$RUNTIME_ENV"
                echo "DJANGO_ALLOWED_HOSTS=$LB_IP,$DOMAIN" >> "$RUNTIME_ENV"

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