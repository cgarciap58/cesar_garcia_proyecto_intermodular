#!/bin/bash
# Este script utiliza los scripts de setup alojados en la máquina administrativa y los lanza en las distintas EC2
# Pasa por el bastión haciendo un salto encadenado

if [ $# -ne 0 ]; then
    echo "Este script no acepta parámetros"
    exit 1
fi

if [ "$(pwd)" == "/home/cgarciap/01.ASIR2/10.Proyecto_intermodular/proyecto_final" ]; then
    cd deployment
elif [ "$(pwd)" == "/home/cgarciap/01.ASIR2/10.Proyecto_intermodular/proyecto_final/deployment" ]; then
    echo "Ya estás en el directorio deployment"
else
    echo "Estás en el directorio incorrecto"
    exit 1
fi

source ./topologia-aws.env

eval "$(ssh-agent -s)"
ssh-add "$KEY_PATH"

echo "¿Qué instancia quieres configurar a su estado base?"
echo "ADVERTENCIA: Esta operación puede ser destructiva y se podrían perder todos los datos."
echo "0. bastion"
echo "1. lb"
echo "2. db"
echo "3. redis"
echo "4. apps"

read -p "--> " maquina

case $maquina in

    0)
        ssh -A $USUARIO_ROOT_EC2@$BASTION_IP_PUB 'bash -s' < ./bastion/bastion_setup.sh
        ;;
    1)
        ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$LB_IP 'bash -s' < ./lb/lb_setup.sh
        ;;

    2)
        DJANGO_APP_EC2_IPS="$APP_IP_1,$APP_IP_2"

        ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$DB_IP \
        "bash -s" \
        -- "$DJANGO_DB_USER" "$DJANGO_DB_PASS" "$DJANGO_DB_DATABASE_NAME" "$DJANGO_APP_EC2_IPS" \
        < ./db/db_setup.sh
        ;;

    3)
        ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$REDIS_IP 'bash -s' < ./redis/redis_setup.sh
        ;;

    4)
        echo "¿Qué instancia EC2 quieres inicializar?"
        echo "1. app1-setup"
        echo "2. app2-setup"
        echo "3. app1-despliegue"
        echo "4. app2-despliegue"

        read -p "--> " app

        case $app in
            1)
                ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$APP_IP_1 'bash -s' < ./app/app_setup.sh 1
                ;;
            2)
                ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$APP_IP_2 'bash -s' < ./app/app_setup.sh 2
                ;;
            3)
                ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$APP_IP_1 "bash -s" -- \
                "$DB_IP" \
                "$REDIS_IP" \
                "$LB_IP_PUB" \
                "$DJANGO_DB_USER" \
                "$DJANGO_DB_PASS" \
                "$DJANGO_DB_DATABASE_NAME" \
                "$DJANGO_SUPERUSER_USERNAME" \
                "$DJANGO_SUPERUSER_EMAIL" \
                "$DJANGO_SUPERUSER_PASSWORD" \
                < ./app/app_deploy.sh
                ;;

            4)
                ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$APP_IP_2 "bash -s" -- \
                "$DB_IP" \
                "$REDIS_IP" \
                "$LB_IP_PUB" \
                "$DJANGO_DB_USER" \
                "$DJANGO_DB_PASS" \
                "$DJANGO_DB_DATABASE_NAME" \
                "$DJANGO_SUPERUSER_USERNAME" \
                "$DJANGO_SUPERUSER_EMAIL" \
                "$DJANGO_SUPERUSER_PASSWORD" \
                < ./app/app_deploy.sh

                ;;
            *)
                echo "Instancia no válida"
                exit 1
                ;;
        esac

        ;;

    *)
        echo "Máquina no válida"
        exit 1
        ;;
esac



# # Path a la clave privada de AWS -- no está en el repositorio por motivos de seguridad
# KEY_PATH=./labsuser.pem

# # Usuarios
# USUARIO_ROOT_EC2=admin # Todas las máquinas son Debian 12

# # Instancias AWS con IP pública
# LB_IP_PUB=100.27.112.104 # IP elástica "inmutable"
# BASTION_IP_PUB=34.226.168.164 # IP elástica "inmutable"

# # Subnet DMZ, instancias - IP privada
# # 10.0.0.0/26

# LB_IP=10.0.0.42

# # Subnet App, instancias - IP privada
# # 10.0.0.64/26

# APP_IP_1=10.0.0.69
# APP_IP_2=10.0.0.100
# REDIS_IP=10.0.0.74

# # Subnet DB, instancias - IP privada
# # 10.0.0.128/26
# DB_IP=10.0.0.150

# # Subnet Bastion, instancias - IP privada
# # 10.0.0.192/26

# BASTION_IP=10.0.0.207
