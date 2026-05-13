#!/bin/bash
set -e

cd app/django

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py makemigrations