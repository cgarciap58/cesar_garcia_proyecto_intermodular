#!/bin/bash
# =============================================================
# utils/backup_db.sh
#
# Hace un volcado (mysqldump) de la base de datos de producción
# y lo guarda en backups/ con timestamp.
#
# Uso:
#   ./utils/backup_db.sh local
#   ./utils/backup_db.sh cloud
#
# Fuentes de variables:
#   Local  \u2192  app/.app.base.env  +  app/.app.local.env
#   Cloud  \u2192  app/.app.base.env  +  app/.app.aws.env
#             + deployment/.aws-map.env
#
# Salida:
#   backups/getbetterDB_<YYYY-MM-DD_HH-MM-SS>_<modo>.sql.gz
# =============================================================

set -euo pipefail

# ------------------------------------------------------------
# 0. Localizar raíz del repositorio (el script vive en utils/)
# ------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKUP_DIR="$REPO_ROOT/backups"

# ------------------------------------------------------------
# 1. Argumento
# ------------------------------------------------------------
MODE="${1:-}"

usage() {
    echo ""
    echo "  Uso: $0 local"
    echo "       $0 cloud"
    echo ""
}

if [[ "$MODE" != "local" && "$MODE" != "cloud" ]]; then
    echo "ERROR: Modo no válido. Debe ser 'local' o 'cloud'."
    usage; exit 1
fi

# ------------------------------------------------------------
# 2. Helper: cargar un .env ignorando comentarios inline
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
echo "=== backup_db.sh  [modo: $MODE] ==="
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
# 4. Validar variables necesarias
# ------------------------------------------------------------
: "${DJANGO_DB_NAME:?DJANGO_DB_NAME no encontrada}"
: "${DJANGO_DB_USER:?DJANGO_DB_USER no encontrada}"
: "${DJANGO_DB_PASS:?DJANGO_DB_PASS no encontrada}"

# ------------------------------------------------------------
# 5. Preparar destino del backup
# ------------------------------------------------------------
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/${DJANGO_DB_NAME}_${TIMESTAMP}_${MODE}.sql.gz"

echo ""
echo ">> Base de datos : $DJANGO_DB_NAME"
echo ">> Destino       : $BACKUP_FILE"
echo ""

# ------------------------------------------------------------
# 6. Ejecutar
# ------------------------------------------------------------
if [[ "$MODE" == "local" ]]; then

    # ---- LOCAL: mysqldump dentro del contenedor, gzip en host ----
    CONTAINER=$(docker ps --filter "name=mariadb" --format "{{.Names}}" | head -1)

    if [[ -z "$CONTAINER" ]]; then
        echo "ERROR: No se encontró ningún contenedor MariaDB en ejecución."
        echo "  Lanza primero: ./infra-local/arrancar_local.sh"
        exit 1
    fi

    echo "   Contenedor: $CONTAINER"
    echo ">> Volcando..."

    docker exec "$CONTAINER" \
        mariadb-dump \
            -u "${DJANGO_DB_USER}" \
            -p"${DJANGO_DB_PASS}" \
            --single-transaction \
            --routines \
            --triggers \
            "${DJANGO_DB_NAME}" \
    | gzip > "$BACKUP_FILE"

else

    # ---- CLOUD: mysqldump en el host remoto, traído por SSH ----
    : "${BASTION_IP_PUB:?BASTION_IP_PUB no encontrada en deployment/.aws-map.env}"
    : "${DB_IP:?DB_IP no encontrada en deployment/.aws-map.env}"
    : "${USUARIO_ROOT_EC2:?USUARIO_ROOT_EC2 no encontrada en deployment/.aws-map.env}"
    : "${KEY_PATH:?KEY_PATH no encontrada en deployment/.aws-map.env}"

    if [[ "$KEY_PATH" != /* ]]; then
        KEY_PATH="$REPO_ROOT/$KEY_PATH"
    fi

    echo "   Bastión : $BASTION_IP_PUB"
    echo "   DB host : $DB_IP"
    echo ">> Volcando via bastión (puede tardar unos segundos)..."

    eval "$(ssh-agent -s)" > /dev/null
    ssh-add "$KEY_PATH" 2>/dev/null

    # El dump corre en el servidor remoto como root (socket auth),
    # el stream llega por SSH y lo comprimimos localmente con gzip
    ssh \
        -o StrictHostKeyChecking=no \
        -o BatchMode=yes \
        -J "${USUARIO_ROOT_EC2}@${BASTION_IP_PUB}" \
        "${USUARIO_ROOT_EC2}@${DB_IP}" \
        "sudo mariadb-dump \
            --single-transaction \
            --routines \
            --triggers \
            ${DJANGO_DB_NAME}" \
    | gzip > "$BACKUP_FILE"

fi

# ------------------------------------------------------------
# 7. Verificar que el fichero no está vacío
# ------------------------------------------------------------
if [[ ! -s "$BACKUP_FILE" ]]; then
    echo "ERROR: El fichero de backup está vacío. Algo salió mal."
    rm -f "$BACKUP_FILE"
    exit 1
fi

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)

echo ""
echo "=== OK: backup completado ==="
echo "   Fichero : $BACKUP_FILE"
echo "   Tamaño  : $SIZE"
echo ""
echo "   Para restaurar:"
if [[ "$MODE" == "local" ]]; then
    echo "   gunzip -c $BACKUP_FILE | docker exec -i $( docker ps --filter 'name=mariadb' --format '{{.Names}}' | head -1 || echo '<contenedor>') mariadb -u ${DJANGO_DB_USER} -p'${DJANGO_DB_PASS}' ${DJANGO_DB_NAME}"
else
    echo "   gunzip -c $BACKUP_FILE > /tmp/restore.sql"
    echo "   ./utils/run_db_query.sh cloud /tmp/restore.sql"
fi
echo ""