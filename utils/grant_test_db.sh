#!/bin/bash
# =============================================================
# grant_test_db.sh
#
# Grants Django test runner privileges on test_<DB_NAME>.
# Reads credentials from env files — no hardcoded values.
#
# Usage:
#   ./infra-local/grant_test_db.sh local
#   ./infra-local/grant_test_db.sh cloud
#
# Local  → reads app/.app.base.env + app/.app.local.env
#          runs the query inside the local MariaDB docker container
#
# Cloud  → reads app/.app.base.env + app/.app.aws.env
#                + deployment/.topologia-aws.env
#          tunnels the query through the bastion to the AWS DB host
# =============================================================

set -euo pipefail

# ------------------------------------------------------------
# 0. Locate repo root (script lives in infra-local/)
# ------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ------------------------------------------------------------
# 1. Parse mode argument
# ------------------------------------------------------------
MODE="${1:-}"
if [[ "$MODE" != "local" && "$MODE" != "cloud" ]]; then
    echo "ERROR: Debes indicar el modo: local o cloud"
    echo "  Uso: $0 local"
    echo "  Uso: $0 cloud"
    exit 1
fi

# ------------------------------------------------------------
# 2. Helper: source an env file stripping inline comments
#    (bash 'source' handles KEY=VALUE fine but comments after
#     the value like  KEY=val # note  can confuse some tools)
# ------------------------------------------------------------
load_env() {
    local env_file="$1"
    if [[ ! -f "$env_file" ]]; then
        echo "ERROR: Fichero de entorno no encontrado: $env_file"
        exit 1
    fi
    echo "   Cargando: $env_file"
    # Strip blank lines and full-line comments, then export
    set -o allexport
    # shellcheck disable=SC1090
    source <(grep -v '^\s*#' "$env_file" | grep -v '^\s*$' | sed 's/\s*#.*$//')
    set +o allexport
}

# ------------------------------------------------------------
# 3. Load environment variables for the selected mode
# ------------------------------------------------------------
echo ""
echo "=== grant_test_db.sh  [modo: $MODE] ==="
echo ""
echo ">> Cargando variables de entorno..."

# Base app env (secrets: SECRET_KEY, DB credentials, Redis pass, etc.)
load_env "$REPO_ROOT/app/.app.base.env"

if [[ "$MODE" == "local" ]]; then
    # Local overrides: DB_HOST=mariadb, DEBUG=True, etc.
    load_env "$REPO_ROOT/app/.app.local.env"
else
    # AWS app overrides
    load_env "$REPO_ROOT/app/.app.aws.env"
    # Topology: IPs, KEY_PATH, BASTION_IP_PUB, USUARIO_ROOT_EC2, DB_IP
    load_env "$REPO_ROOT/deployment/.topologia-aws.env"
fi

# ------------------------------------------------------------
# 4. Validate the variables we actually need
# ------------------------------------------------------------
: "${DJANGO_DB_USER:?Variable DJANGO_DB_USER no encontrada en los ficheros de entorno}"
: "${DJANGO_DB_PASS:?Variable DJANGO_DB_PASS no encontrada en los ficheros de entorno}"
: "${DJANGO_DB_NAME:?Variable DJANGO_DB_NAME no encontrada en los ficheros de entorno}"

TEST_DB="test_${DJANGO_DB_NAME}"

echo ""
echo ">> Configuración:"
echo "   DB usuario : $DJANGO_DB_USER"
echo "   DB nombre  : $DJANGO_DB_NAME"
echo "   Test DB    : $TEST_DB"
echo ""

# ------------------------------------------------------------
# 5. Build the SQL to execute
# ------------------------------------------------------------
SQL=$(cat <<SQL
CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON \`${TEST_DB}\`.* TO '${DJANGO_DB_USER}'@'%';

FLUSH PRIVILEGES;

SELECT 'OK: privilegios concedidos sobre ${TEST_DB}' AS resultado;
SQL
)

# ------------------------------------------------------------
# 6. Execute
# ------------------------------------------------------------
if [[ "$MODE" == "local" ]]; then

    # ---- LOCAL: run inside the mariadb docker container ----
    : "${MARIADB_ROOT_PASSWORD:?Variable MARIADB_ROOT_PASSWORD no encontrada (necesaria para local)}"

    # Detect container name: prefer a running container whose
    # image name contains "mariadb", fallback to service name.
    CONTAINER=$(docker ps --filter "ancestor=mariadb" --format "{{.Names}}" | head -1)
    if [[ -z "$CONTAINER" ]]; then
        # docker-compose names it as <project>-mariadb-1 or simply mariadb
        CONTAINER=$(docker ps --filter "name=mariadb" --format "{{.Names}}" | head -1)
    fi

    if [[ -z "$CONTAINER" ]]; then
        echo "ERROR: No se encontró ningún contenedor MariaDB en ejecución."
        echo "  Asegúrate de haber ejecutado: ./infra-local/arrancar_local.sh"
        exit 1
    fi

    echo ">> Contenedor MariaDB detectado: $CONTAINER"
    echo ">> Ejecutando SQL..."
    echo ""

    echo "$SQL" | docker exec -i "$CONTAINER" \
        mariadb -u root -p"${MARIADB_ROOT_PASSWORD}"

else

    # ---- CLOUD: tunnel through bastion to AWS DB host ----
    : "${BASTION_IP_PUB:?Variable BASTION_IP_PUB no encontrada en .topologia-aws.env}"
    : "${DB_IP:?Variable DB_IP no encontrada en .topologia-aws.env}"
    : "${USUARIO_ROOT_EC2:?Variable USUARIO_ROOT_EC2 no encontrada en .topologia-aws.env}"
    : "${KEY_PATH:?Variable KEY_PATH no encontrada en .topologia-aws.env}"
    : "${MARIADB_ROOT_PASSWORD:?Variable MARIADB_ROOT_PASSWORD no encontrada}"

    echo ">> Saltando via bastión: $BASTION_IP_PUB  →  $DB_IP"
    echo ">> Ejecutando SQL en host remoto..."
    echo ""

    # Load the SSH key into the agent so the ProxyJump works
    eval "$(ssh-agent -s)" > /dev/null
    ssh-add "$KEY_PATH" 2>/dev/null

    # Pipe SQL through the bastion jump directly into mariadb on the DB host
    echo "$SQL" | ssh \
        -o StrictHostKeyChecking=no \
        -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
        "${USUARIO_ROOT_EC2}@${DB_IP}" \
        "sudo mariadb -u root -p'${MARIADB_ROOT_PASSWORD}'"

fi

echo ""
echo "=== Listo. El usuario '${DJANGO_DB_USER}' ya puede crear/destruir '${TEST_DB}'. ==="
echo ""