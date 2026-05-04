# GetBetter

Plataforma web SaaS para clínicas psicológicas desplegada en arquitectura híbrida:

- AWS (Load Balancer + App Servers + Redis + MariaDB)
- Active Directory local integrado
- Login corporativo LDAP
- Alta disponibilidad
- Despliegue automatizado

---

## Acceso público
https://getbetter.ddns.net

---

## Estructura base del repositorio

```
repositorio/
│
├── docs/               # Documentación general del proyecto en su conjunto
│
├── app/                # Código Django
│
├──── app/docker        # Configuración adicional de los contenedores Docker de la app
│
├──── app/src           # Código fuente de la aplicación
│
├── infra-local/        # Configuración local para desarrollo y scripts útiles para desarrollo local
│
├── deployment/         # Scripts para instalación de todos los servicios en AWS
│
├── windows-server/     # Scripts para despliegue de Windows Server con Active Directory y otros servicios

```

---

## Ejecución local

Para levantar la aplicación en local:

1. Asegúrate de que Docker y Docker Compose están instalados
2. Crea el archivo `.env.local` utilizando la plantilla `.env.local.example`

3. Desde el repositorio base, simplemente ve al repositorio base y lanza:

```bash
./infra-local/arrancar_local.sh
```

---

## Arquitectura visual

Internet <-> Load Balancer <-> App1 / App2 (Docker + Django) <-> Redis + MariaDB

App1 / App2 (Docker + Django) <-> Red privada Tailscale <-> Windows Server AD local

---

## Flujo de red

### Usuarios internos (empleados)

```
Cliente Windows
   │
   │ autenticación dominio (LDAP interno)
   ▼
Active Directory
   │
   │ SSO (Single Sign-On)
   │
Internet
   │
   ▼
Load Balancer AWS
   │
   ▼
Django
   │
   │ SSO
   ▼
Login finalizado
```

Los empleados:

* inician sesión en el dominio
* acceden a la aplicación web
* Django valida sus credenciales contra Active Directory


### Usuarios externos (pacientes)

```
Paciente
   │
   ▼
Internet
   │
   ▼
Load Balancer AWS
   │
   ▼
Django
   │
   │ Auth contra Base de Datos
   ▼
Login finalizado
```

Los pacientes:

* crean cuenta en la aplicación
* se autentican directamente contra la base de datos de Django

---

## Despliegue AWS

Los scripts de despliegue se encuentran en la carpeta `deployment/`.

---

## Tecnologías utilizadas

### Sistemas Operativos

- Linux Debian
- Linux Alpine
- Windows Server
- Windows 10-11

### Infraestructura

   - AWS
      - EC2
      - VPC + Subnets
      - Grupos de seguridad (SGs)
      - Tablas de enrutamiento

   - Docker + Docker Compose
   - Tailscale

   - Windows Server Active Directory

### Stack de desarrollo + servicios

   - Nginx
   - Django + Gunicorn
   - MariaDB
   - Redis
   Linux
   Windows Server
   Active Directory
   LDAP
   Bash

---

## Estado actual

✅ Infra AWS desplegada  
✅ Balanceador funcional  
✅ 2 nodos app  
✅ Redis sesiones compartidas  
✅ MariaDB productiva  
✅ Tailscale conectado a AD  
🔄 Integración Django LDAP en progreso