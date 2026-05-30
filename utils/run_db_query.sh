#!/bin/bash
# =============================================================
# utils/run_db_query.sh
#
# Ejecuta cualquier fichero .sql contra MariaDB, ya sea en
# local (contenedor Docker) o en cloud (AWS, saltando por bastión).
#
# Uso:
#   ./utils/run_db_query.sh local  <fichero.sql>
#   ./utils/run_db_query.sh cloud  <fichero.sql>
#
# Fuentes de variables:
#   Local  →  app/.app.base.env  +  app/.app.local.env
#   Cloud  →  app/.app.base.env  +  app/.app.aws.env
#             + deployment/.aws-map.env
#
# Credenciales necesarias según modo:
#   Local  →  MARIADB_ROOT_PASSWORD  (en .app.local.env o .app.base.env)
#   Cloud  →  sudo sin contraseña (socket auth de MariaDB en AWS),
#             KEY_PATH, BASTION_IP_PUB, USUARIO_ROOT_EC2, DB_IP
#             (en deployment/.aws-map.env)
# =============================================================

set -euo pipefail

# ------------------------------------------------------------
# 0. Localizar raíz del repositorio (el script vive en utils/)
# ------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ------------------------------------------------------------
# 1. Argumentos
# ------------------------------------------------------------
MODE="${1:-}"
SQL_FILE="${2:-}"

usage() {
    echo ""
    echo "  Uso: $0 local <fichero.sql>"
    echo "       $0 cloud <fichero.sql>"
    echo ""
}

if [[ "$MODE" != "local" && "$MODE" != "cloud" ]]; then
    echo "ERROR: Modo no válido. Debe ser 'local' o 'cloud'."
    usage; exit 1
fi

if [[ -z "$SQL_FILE" ]]; then
    echo "ERROR: Debes indicar un fichero .sql como segundo argumento."
    usage; exit 1
fi

# Permite rutas relativas lanzadas desde cualquier directorio
if [[ "$SQL_FILE" != /* ]]; then
    SQL_FILE="$(pwd)/$SQL_FILE"
fi

if [[ ! -f "$SQL_FILE" ]]; then
    echo "ERROR: Fichero SQL no encontrado: $SQL_FILE"
    exit 1
fi

# ------------------------------------------------------------
# 2. Helper: cargar un .env ignorando comentarios inline
#    KEY=valor # comentario  →  sólo carga KEY=valor
# ------------------------------------------------------------
load_env() {
    local env_file="$1"
    if [[ ! -f "$env_file" ]]; then
        echo "ERROR: Fichero de entorno no encontrado: $env_file"
        exit 1
    fi
    echo "   Cargando: $env_file"
    set -o allexport
    # shellcheck disable=SC1090
    source <(grep -v '^\s*#' "$env_file" | grep -v '^\s*$' | sed 's/[[:space:]]*#.*$//')
    set +o allexport
}

# ------------------------------------------------------------
# 3. Cargar variables de entorno según el modo
# ------------------------------------------------------------
echo ""
echo "=== run_db_query.sh  [modo: $MODE] ==="
echo "=== SQL: $SQL_FILE ==="
echo ""
echo ">> Cargando variables de entorno..."

load_env "$REPO_ROOT/app/.app.base.env"

if [[ "$MODE" == "local" ]]; then
    load_env "$REPO_ROOT/app/.app.local.env"
else
    load_env "$REPO_ROOT/app/.app.aws.env"
    load_env "$REPO_ROOT/deployment/.aws-map.env"
fi

# ------------------------------------------------------------
# 4. Ejecutar
# ------------------------------------------------------------
echo ""
echo ">> Ejecutando: $(basename "$SQL_FILE")"
echo ""

if [[ "$MODE" == "local" ]]; then

    # ---- LOCAL: ejecutar dentro del contenedor MariaDB ----
    : "${DJANGO_DB_PASS:?DJANGO_DB_PASS no encontrada en app/.app.local.env}"
    # En local, MYSQL_ROOT_PASSWORD == DJANGO_DB_PASS (ver infra-local/docker-compose.yml)

    # Detectar contenedor en ejecución (Docker Compose v1 y v2)
    CONTAINER=$(docker ps --filter "name=mariadb" --format "{{.Names}}" | head -1)

    if [[ -z "$CONTAINER" ]]; then
        echo "ERROR: No se encontró ningún contenedor MariaDB en ejecución."
        echo "  Lanza primero: ./infra-local/arrancar_local.sh"
        exit 1
    fi

    echo "   Contenedor: $CONTAINER"
    echo ""

    docker exec -i "$CONTAINER" \
        mariadb -u root -p"${DJANGO_DB_PASS}" \
        < "$SQL_FILE"

else

    # ---- CLOUD: piped a través del bastión al host DB ----
    : "${BASTION_IP_PUB:?BASTION_IP_PUB no encontrada en deployment/.aws-map.env}"
    : "${DB_IP:?DB_IP no encontrada en deployment/.aws-map.env}"
    : "${USUARIO_ROOT_EC2:?USUARIO_ROOT_EC2 no encontrada en deployment/.aws-map.env}"
    : "${KEY_PATH:?KEY_PATH no encontrada en deployment/.aws-map.env}"

    # Resolver ruta relativa de la clave desde la raíz del repo
    if [[ "$KEY_PATH" != /* ]]; then
        KEY_PATH="$REPO_ROOT/$KEY_PATH"
    fi

    echo "   Bastión : $BASTION_IP_PUB"
    echo "   DB host : $DB_IP"
    echo ""

    eval "$(ssh-agent -s)" > /dev/null
    ssh-add "$KEY_PATH" 2>/dev/null

    # En AWS el usuario root de MariaDB usa socket auth → sudo mariadb sin contraseña
    ssh \
        -o StrictHostKeyChecking=no \
        -o BatchMode=yes \
        -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
        "${USUARIO_ROOT_EC2}@${DB_IP}" \
        "sudo mariadb" \
        < "$SQL_FILE"

fi

echo ""
echo "=== OK: query ejecutada correctamente. ==="
echo ""