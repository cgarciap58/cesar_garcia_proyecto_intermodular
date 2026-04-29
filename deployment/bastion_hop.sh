#!/bin/bash

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
# ssh-add labsuser.pem

echo "$BASTION_IP"
echo "$BASTION_USER"

echo "Transfiriendo los archivos de deployment al bastión..."

ssh admin@$BASTION_IP "mkdir -p /home/admin/deployment"
scp -r ../deployment/load_balancer $BASTION_USER@$BASTION_IP:/home/admin/deployment/
scp -r ../deployment/app $BASTION_USER@$BASTION_IP:/home/admin/deployment/
ssh admin@$BASTION_IP "chmod -R +x /home/admin/deployment"

ssh -A admin@$BASTION_IP # Esta IP cambia en cada despliegue


