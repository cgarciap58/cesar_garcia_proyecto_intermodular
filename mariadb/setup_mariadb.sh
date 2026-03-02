# https://medium.com/code-zen/django-mariadb-85cc9daeeef8

sudo apt update
sudo apt install mariadb-server
unset TMPDIR
sudo mysql_install_db
sudo mysql -uroot

db_name="db_proyecto_final"

sudo mysql -u root -e "DROP DATABASE IF EXISTS $db_name;"
sudo mysql -u root -e "CREATE DATABASE $db_name;"
sudo mysql -u root $db_name < setup_mariadb.sql