#!/bin/bash

set -e

echo "Actualizando el sistema..."
sudo apt update

echo "Instalando nginx..."
sudo apt install -y nginx

echo "Copiando configuración..."
sudo cp configs/nginx/default.conf /etc/nginx/sites-available/default

echo "Reiniciando nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "Configuración Nginx completa"