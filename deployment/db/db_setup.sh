# This should come from .env
db_django_user="django"
db_django_password="admin"
db_name="db_proyecto_final"
django_ips="10.0.20.%" # Cambiar este rango por la red donde estarán las máquinas Django

sudo apt update

# sudo apt install chrony -y # Para sincronizar el reloj

sudo apt install -y mariadb-server
unset TMPDIR
sudo mysql_install_db

echo "Éxito: Instalada MariaDB"

sudo mysql -u root -e "DROP DATABASE IF EXISTS $db_name;"
sudo mysql -u root -e "CREATE DATABASE $db_name;"

echo "Éxito: Creada la base de datos $db_name"

sudo mysql -u root -e "CREATE USER '$db_django_user'@'%' IDENTIFIED BY '$db_django_password';"

echo "Éxito: Creada la base de datos: [[$db_django_user]] con contraseña [[$db_django_password]]"

sudo mysql -u root -e "GRANT CREATE, SELECT, INSERT, ALTER, UPDATE, INDEX, DELETE ON $db_name.* TO '$db_django_user'@'%';"
sudo mysql -u root -e "FLUSH PRIVILEGES;"

echo "Éxito: Modificados los permisos para [[$db_django_user]] en la base de datos [[$db_name]]"

sudo sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf # Esta línea tiene que ser capada para que solo las IPs de los EC2 de Django se permitan
sudo systemctl restart mariadb

echo "Éxito: Configurada MariaDB para aceptar conexiones remotas"

sleep 2

echo "Éxito, ¡base de datos configurada correctamente!"

