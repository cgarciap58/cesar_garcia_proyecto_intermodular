# Guía rápida de estructura y ejecución

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

## Qué ejecutar

Para levantar la aplicación en local:

1. Asegúrate de que Docker y Docker Compose están instalados
2. Crea el archivo `.env.local` utilizando la plantilla `.env.local.example`

3. Desde el repositorio base, simplemente ve al repositorio base y lanza:

```bash
./infra-local/arrancar_local.sh
```

Para despliegue en nube:

1. Contacta con cgarciap58@iesalbarregas.es


Consulta también `docs/escenarios-ejecucion.md` para una guía paso a paso por escenario.

---

# Resumen del proyecto

El proyecto es una web app SaaS (Software as a Service) orientado a satisfacer las necesidades de clínicas psicológicas.
Para ello, como prueba, se despliega la arquitectura de una empresa ficticia (una clínica) junto con su web app para atención a pacientes.

## 1. Arquitectura en despliegue

La simulación de la empresa incluye:

1. **Infraestructura corporativa interna (VirtualBox)**
   - Windows Server 2022 con Active Directory
   - Cliente Windows 1 (usuario empleado)

2. **Infraestructura en red en la nube (AWS)**
   - EC2 con LB para mayor disponibilidad, más resiliencia y escalabilidad (subred pública)
      - También se encarga de gestionar tráfico HTTPS
      - En subred pública, accesible desde https://getbetter.ddns.net/
   - EC2 con aplicación web (dos o más). Cada una de ellas despliega un docker compose con dos contenedores:
      - Nginx: Recibe el tráfico del LB
      - Django: Aplicación web
   - EC2 con base de datos (MariaDB). Guarda los datos persistentes para la app web.
   - EC2 con memoria caché (Redis).
      - Reduce la carga en la base de datos para información que no necesita de persistencia
      - Permite que se mantenga la sesión abierta aunque se produzca un cambio en la EC2 que sirve al cliente
   - EC2 Bastión
      - Permite el acceso controlado a los servicios internos (ssh)

3. **Infraestructura de red en la nube (AWS)**
   - VPC
   - Subredes públicas (una, la DMZ, para el LB y otra para la EC2 Bastión)
   - Subredes privadas (dos, una para las EC2 con la app web y Redis, y otra para la EC2 con la base de datos)
   - Route table
   - Security group
   - Internet gateway
   - NAT gateway
   - ELB (Elastic Load Balancer)

Simular la infraestructura tecnológica de una **empresa de atención psicológica**, incluyendo:

* gestión de usuarios corporativos
* autenticación centralizada
* aplicación web para gestión de citas
* despliegue híbrido (infraestructura local + cloud)

El sistema debe permitir:

* autenticación centralizada para empleados
* acceso web para pacientes
* gestión de citas entre psicólogos y pacientes
* separación entre infraestructura interna y servicios públicos

---


# 4. Flujo de red

## 4.1 Usuarios internos (empleados)

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

---

## 4.2 Usuarios externos (pacientes)

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


# 5. Decisiones sobre tecnlogía

| Componente       | Tecnología            | Motivo                                    |
| ---------------- | --------------------- | ------------------------------------------|
| Django           | Framework web         | desarrollo rápido                         |
| Docker           | Contenerización       | despliegue reproducible                   |
| MariaDB          | Base de datos         | compatibilidad con Django + Open source   |
| Redis            | Memoria caché         | Necesario para balanceo                   |
| Active Directory | Identidad corporativa | Autenticación centralizada para empleados |
| LDAP             | Integración AD        | implementación sencilla                   |
| AWS EC2          | hosting               | simulación cloud real                     |
| Load Balancer    | escalabilidad         | arquitectura profesional                  |
