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

source ./config.env

eval "$(ssh-agent -s)"
ssh-add $KEY_PATH

echo "¿A qué máquina deseas saltar? "
echo "0. bastion"
echo "1. lb"
echo "2. apps"
echo "3. redis"
echo "4. db"

read -p "--> " maquina

case $maquina in

    0)
        ssh -A $USUARIO_ROOT_EC2@$BASTION_IP_PUB
        ;;
    1)
        ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$LB_IP
        ;;
    2)
        echo "¿A qué instancia EC2 de app quieres saltar? "
        echo "1. app1"
        echo "2. app2"

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
    3)
        ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$REDIS_IP
        ;;
    4)
        ssh -J $USUARIO_ROOT_EC2@$BASTION_IP_PUB $USUARIO_ROOT_EC2@$DB_IP
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
