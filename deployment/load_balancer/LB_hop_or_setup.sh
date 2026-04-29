#!/bin/bash
set -e

LB_IP="10.0.0.42"

echo "Load Balancer: $LB_IP"
read -p "¿Automático setup (A) o Entrar (E)? " respuesta

case "$respuesta" in
    A|a)
        echo "Copiando setup.sh..."
        scp /home/admin/deployment/load_balancer/LB_setup.sh admin@$LB_IP:/home/admin/

        echo "Asignando permisos..."
        ssh admin@$LB_IP "chmod +x /home/admin/LB_setup.sh"

        echo "Ejecutando setup..."
        ssh admin@$LB_IP "/home/admin/LB_setup.sh"
        ;;

    E|e)
        echo "Entrando al servidor..."
        ssh admin@$LB_IP
        ;;

    *)
        echo "Opción inválida. Usa A o E"
        exit 1
        ;;
esac