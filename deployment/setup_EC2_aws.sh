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

echo "¿Qué instancia quieres configurar a su estado base, o desplegar?"
echo "ADVERTENCIA: Esta operación puede ser destructiva y se podrían perder todos los datos."
echo "0. Bastion"
echo "1. LB"
echo "2. DB"
echo "3. Redis"
echo "4. Apps"

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

        source ../app/.app.aws.env

        ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$DB_IP \
        "bash -s" \
        -- "$DJANGO_DB_USER" "$DJANGO_DB_PASS" "$DJANGO_DB_NAME" "$DJANGO_APP_EC2_IPS" \
        < ./db/db_setup.sh
        ;;

    3)

        APP_NODES="$APP_IP_1 $APP_IP_2"
    
        ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB \
        $USUARIO_ROOT_EC2@$REDIS_IP \
        "bash -s" \
        -- "$REDIS_IP" "$APP_IP_1" "$APP_IP_2" "$REDIS_PASS" \
        < ./redis/redis_setup.sh
        ;;

    4)
        echo "¿Qué instancia EC2 quieres inicializar o desplegar?"
        echo "1. EC2-App1"
        echo "2. EC2-App2"

        read -p "--> " app

        case $app in
            1)
                IP=$APP_IP_1

                ;;
            2)
                IP=$APP_IP_2
                ;;
            *)
                echo "Instancia no válida"
                exit 1
                ;;
        esac


        echo "¿Quieres inicializar o desplegar? (no hay vuelta atrás)"
        echo "1. Inicializar/setup"
        echo "2. Desplegar/deploy"

        read -p "--> " opcion


        case $opcion in
            1)
                ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$IP 'bash -s' < ./app/app_setup.sh
                ;;
            2)
                cat ../app/.app.base.env > .env.runtime
                cat ../app/.app.aws.env >> .env.runtime

                # Creamos el .env
                echo "DB_HOST=$DB_IP" >> .env.runtime
                echo "REDIS_HOST=$REDIS_IP" >> .env.runtime
                echo "DJANGO_ALLOWED_HOSTS=$LB_IP,$DOMAIN" >> .env.runtime

                scp -o ProxyJump=$USUARIO_ROOT_EC2@$BASTION_IP_PUB .env.runtime $USUARIO_ROOT_EC2@$IP:/tmp/.env.runtime
                ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$IP 'bash -s' < ./app/app_deploy.sh
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

