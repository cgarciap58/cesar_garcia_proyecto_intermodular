"""
Django settings for config project.
Safe debug-ready version for Docker + local dev.
"""

from pathlib import Path
import os
import environ

BASE_DIR = Path(__file__).resolve().parent.parent

# Initialize environ
env = environ.Env(
    DEBUG=(bool, False)
)

# Load .env if it exists (useful for local dev)
env_path = BASE_DIR / ".env"
if env_path.exists():
    environ.Env.read_env(env_path)

# ----------------------
# Debug / Environment dump
# ----------------------
debug_file_path = BASE_DIR / "debug.log"
with open(debug_file_path, "w") as debug_file:
    debug_file.write("=== ENVIRONMENT VARIABLES ===\n")
    for var in ["DJANGO_SECRET_KEY", "DJANGO_DEBUG", "DJANGO_ALLOWED_HOSTS",
                "DB_ENGINE", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_HOST", "DB_PORT"]:
        value = os.environ.get(var)
        debug_file.write(f"{var}: {value}\n")
    debug_file.write("=============================\n")

# ----------------------
# SECURITY
# ----------------------
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-secret-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "True") == "True"
ALLOWED_HOSTS = [host.strip() for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if host.strip()]
DB_ENGINE = os.environ.get("DB_ENGINE", "django.db.backends.sqlite3")
DB_NAME = os.environ.get("DB_NAME", "db.sqlite3")
DB_USER = os.environ.get("DB_USER", "")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
DB_HOST = os.environ.get("DB_HOST", "")
DB_PORT = os.environ.get("DB_PORT", "")

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
    'ENGINE': DB_ENGINE,
    'NAME': DB_NAME,
    'USER': DB_USER,
    'PASSWORD': DB_PASSWORD,
    'HOST': DB_HOST,
    'PORT': DB_PORT,
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
