#!/bin/bash
set -e

if [ $# -ne 1 ]; then
    echo "Uso: $0 <numero_instancia>"
    exit 1
fi

instacia_app=$1

case "$instacia_app" in
    1)
        APP_IP="10.0.0.69"
        ;;
    2)
        APP_IP="10.0.0.100"
        ;;
    *)
        echo "Número de instancia inválido. Usa 1 o 2"
        exit 1
        ;;
esac


echo "Trabajando con instancia $instacia_app en IP $APP_IP"
read -p "¿Despliegue de cero Automático (A) o Entrar (E)? " respuesta

case "$respuesta" in
    A|a)
        echo "Copiando setup.sh..."
        scp /home/admin/deployment/app/app_setup.sh admin@$APP_IP:/home/admin/

        echo "Asignando permisos..."
        ssh admin@$APP_IP "chmod +x /home/admin/app_setup.sh"

        echo "Ejecutando setup..."

        case "$1" in
            1)
                ssh admin@$APP_IP "/home/admin/app_setup.sh $instacia_app"
                ;;
            2)
                ssh admin@$APP_IP "/home/admin/app_setup.sh $instacia_app"
                ;;
        esac


        ;;

    E|e)
        echo "Entrando al servidor..."
        ssh admin@$APP_IP
        ;;

    *)
        echo "Opción inválida. Usa A o E"
        exit 1
        ;;
esac