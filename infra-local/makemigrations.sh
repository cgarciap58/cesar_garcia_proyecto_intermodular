#!/bin/bash
set -e
set -a

cd app/django

python3 -m venv venv
source venv/bin/activate
source ../.env.runtime
pip install -r requirements.txt
python manage.py makemigrations