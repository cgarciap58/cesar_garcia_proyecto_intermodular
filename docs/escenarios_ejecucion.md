# Guía de ejecución por escenarios

## Escenario 1: Ejecutar la app Django en Docker

```bash
docker compose up --build
```

Esto utiliza:
- `docker-compose.yml`
- `app/docker/django/Dockerfile`
- `app/docker/nginx/Dockerfile`

## Escenario 2: Desarrollo local con autoreload

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up --build
```

El `override` monta `app/src` dentro del contenedor para reflejar cambios al instante.

## Escenario 3: Preparar MariaDB en EC2

```bash
bash database/setup_db.sh
```

Script pensado para aprovisionar MariaDB y crear base de datos/usuario para Django.

## Escenario 4: Depurar conexión a MariaDB

```bash
bash database/debug_db.sh
```

Lanza un comando `mysql` manual para validar conectividad y credenciales.

## Escenario 5: Operaciones de Active Directory en Windows Server

Ejecutar en PowerShell:

```powershell
.\ops\windows-ad\creacion_OUs.ps1
```

Crea la estructura de OUs definida para Active Directory.
