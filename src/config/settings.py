"""
Django settings for config project.
Safe debug-ready version for Docker + local dev.
"""

from pathlib import Path
# import os
import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

# Initialize environ
env = environ.Env(
    # DEBUG=(bool, False)
    DJANGO_DEBUG=(bool, False)
)

# Load .env if it exists (useful for local dev)
env_path = BASE_DIR / ".env"
if env_path.exists():
    environ.Env.read_env(env_path)

# # ----------------------
# # Debug / Environment dump
# # ----------------------
# debug_file_path = BASE_DIR / "debug.log"
# with open(debug_file_path, "w") as debug_file:
#     debug_file.write("=== ENVIRONMENT VARIABLES ===\n")
#     for var in ["DJANGO_SECRET_KEY", "DJANGO_DEBUG", "DJANGO_ALLOWED_HOSTS",
#                 "DB_ENGINE", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_HOST", "DB_PORT"]:
#         value = os.environ.get(var)
#         debug_file.write(f"{var}: {value}\n")
#     debug_file.write("=============================\n")

# Load .env from repository root first (where docker-compose.yml lives),
# then fallback to src/.env for local-only setups.
for candidate in (PROJECT_ROOT / ".env", BASE_DIR / ".env"):
    if candidate.exists():
        environ.Env.read_env(candidate)
        break


# ----------------------
# SECURITY
# ----------------------
# SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-secret-key")
# DEBUG = os.environ.get("DJANGO_DEBUG", "True") == "True"
# ALLOWED_HOSTS = [host.strip() for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if host.strip()]
# DB_ENGINE = os.environ.get("DB_ENGINE", "django.db.backends.sqlite3")
# DB_NAME = os.environ.get("DB_NAME", "db.sqlite3")
# DB_USER = os.environ.get("DB_USER", "")
# DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
# DB_HOST = os.environ.get("DB_HOST", "")
# DB_PORT = os.environ.get("DB_PORT", "")

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-secret-key")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = [
    host.strip()
    for host in env("DJANGO_ALLOWED_HOSTS", default="").split(",")
    if host.strip()
]


# ----------------------
# Application definition
# ----------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # 'django.apps.RecordsConfig',
    'records',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ----------------------
# Database
# ----------------------
DATABASES = {
    'default': {
        'ENGINE': env('DB_ENGINE', default='django.db.backends.mysql'),
        'NAME': env('DB_NAME', default='db_proyecto_final'),
        'USER': env('DB_USER', default='django'),
        'PASSWORD': env('DB_PASSWORD', default=''),
        'HOST': env('DB_HOST', default='172.17.0.1'),
        'PORT': env('DB_PORT', default='3306'),    
    }
}

# ----------------------
# Password validation
# ----------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',},
]

# ----------------------
# Internationalization
# ----------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ----------------------
# Static files
# ----------------------
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
