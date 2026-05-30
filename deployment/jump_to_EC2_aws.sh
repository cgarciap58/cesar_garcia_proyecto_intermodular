if [ $# -gt 0 ]; then
    echo "No hacen falta parámetros."
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

source ./.aws-map.env

eval "$(ssh-agent -s)"
ssh-add $KEY_PATH

echo "¿A qué máquina deseas saltar? "
echo "0. Bastión"
echo "1. Load Balancer"
echo "2. Redis"
echo "3. Database"
echo "4. Apps"

read -p "--> " maquina

case $maquina in

    0)
        ssh -A $USUARIO_ROOT_EC2@$BASTION_IP_PUB
        ;;
    1)
        ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$LB_IP
        ;;
    2)
        ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$REDIS_IP
        ;;
    3)
        ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$DB_IP
        ;;
    4)
        echo "¿A qué instancia EC2 de app quieres saltar? "
        echo "1. App 1"
        echo "2. App 2"

        read -p "--> " app

        case $app in
            1)
                ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$APP_IP_1
                ;;
            2)
                ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$APP_IP_2
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
