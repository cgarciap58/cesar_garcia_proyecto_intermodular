#!/bin/bash

# Nota: Lanzar desde la raíz del proyecto
# Hay que tener primero al menos un backup en /backups/
# Luego ejecutar: ./utils/read_backups.sh {./backups/nombre_del_backup.sql.gz}

echo "¿Quieres leer o descomprimir el backup?"
echo "1. Leer en terminal"
echo "2. Descomprimir"

read -p "--> " opcion


if [[ "$opcion" == "1" ]]
then
    zcat "$1"
elif [[ "$opcion" == "2" ]]
then
    gunzip -k "$1"
    if [ $? -eq 0 ]; then
        echo "Backup descomprimido en ./backups/"
    else
        echo "Error al descomprimir el backup"
    fi
fi