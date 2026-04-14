# (Temporal) Lista de TODOS a nivel arquitectura:

- [X] Poner en funcionamiento una aplicación web Django contenerizada
- [X] Poner en funcionamiento una aplicación web Django contenerizada, pero la base de datos es externa
- [X] Sistema de tickets en la aplicación web
- [ ] Sistema de autenticación para empleados (LDAP/Active Directory)
    - [X] Prueba 1: Servidor web dentro de la red local, acceso a la BBDD en la misma máquina, pero fuera del contenedor.
    - [ ] Prueba 2: Servidor web (aplicación web dockerizada) dentro de la red local, con acceso servidor BBDD en la red local.
    - [ ] Prueba 3: Windows Server en red local, con acceso a la aplicación web y BBDD en AWS.
    - [ ] Prueba 4: Windows Server en red local, con comunicación con LDAP-Kerberos
    - [ ] Prueba 5: Windows Server en red local, con comunicación con LDAP-Kerberos y just in-time provisioning.
- [ ] Revisión de seguridad en AWS
- [ ] Sistema de autenticación para pacientes (Django)
- [ ] Sistema de gestión de citas
- [ ] Revisión de seguridad


# Arquitectura del Proyecto Final ASIR

## 1. Objetivo del proyecto

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

# 2. Arquitectura general

La arquitectura está dividida en **dos entornos principales**:

## 2.1 Infraestructura corporativa interna (VirtualBox)

Simula la red interna de la empresa.

Componentes:

```
Red interna VirtualBox
│
├── Windows Server 2022
│   └ Active Directory Domain Services
│
├── Cliente Windows 1
│   └ Usuario empleado
│
├── Cliente Windows 2
│   └ Usuario empleado
│
└── Router Linux virtual
    ├ interfaz red interna
    └ interfaz NAT (salida internet)
```

Funciones:

* gestión de identidades
* autenticación corporativa
* simulación de red empresarial

---

## 2.2 Infraestructura cloud (AWS)

Aquí vive la **aplicación productiva**.

Componentes principales:

```
AWS
│
├ EC2
│  ├ Docker
│  │  ├ Django container
│  │  └ Django container (replica)
│  │
│  └ Redis
│
├ MariaDB
│
└ Load Balancer
```

Funciones:

* servir la aplicación web
* persistencia de datos
* escalabilidad

---

# 3. Flujo de red

## 3.1 Usuarios internos (empleados)

```
Cliente Windows
      │
      │ autenticación dominio
      ▼
Active Directory
      │
      │ LDAP
      ▼
Aplicación Django (AWS)
```

Los empleados:

* inician sesión en el dominio
* acceden a la aplicación web
* Django valida sus credenciales contra Active Directory

---

## 3.2 Usuarios externos (pacientes)

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
   ▼
Base de datos
```

Los pacientes:

* crean cuenta en la aplicación
* se autentican directamente contra la base de datos de Django

---

# 4. Modelo de autenticación

## 4.1 Autenticación de empleados

Tecnología elegida:

```
django-auth-ldap
```

Flujo:

```
Login usuario
     │
     ▼
Django
     │
     ▼
LDAP query
     │
     ▼
Active Directory
```

Si el usuario pertenece a determinadas **OU**, se le permite acceso.

---

## 4.2 Sincronización de usuarios

Usuarios corporativos deben existir también en la aplicación.

Estrategia:

```
Active Directory
      │
      ▼
LDAP login
      │
      ▼
Django crea usuario local automáticamente
```

Este patrón se denomina:

**Just-In-Time User Provisioning**

Reglas:

* solo OU específicas
* roles asignados según grupo AD

Ejemplo conceptual:

```
OU=Psychologists → role=psicólogo
OU=Reception → role=recepción
OU=IT → role=administrador
```

---

# 5. Arquitectura de la aplicación

Aplicación web desarrollada con:

```
Django
```

Funcionalidades:

* gestión de citas
* agenda de psicólogos
* gestión de pacientes
* autenticación

---

## 5.1 Despliegue

La aplicación se ejecuta en contenedores:

```
Docker
```

Estructura:

```
EC2
│
├ Django container
├ Django container (replica)
└ Redis
```

---

# 6. Balanceo de carga

Se utilizará un **Load Balancer** para distribuir tráfico.

Motivación:

* simular arquitectura escalable
* permitir múltiples contenedores

Arquitectura:

```
Internet
   │
   ▼
AWS Load Balancer
   │
   ├ Django container 1
   └ Django container 2
```

---

# 7. Gestión de sesiones

Problema:

En un sistema con **varios contenedores**, las sesiones locales se pierden.

Ejemplo de problema:

```
Login en container A
↓
Siguiente petición va a container B
↓
Sesión no existe
↓
Usuario desconectado
```

Solución:

```
Redis
```

Redis actúa como **session store compartido**.

Arquitectura:

```
Django containers
     │
     ▼
Redis
     │
     ▼
Sesiones compartidas
```

Beneficios:

* persistencia de sesiones
* escalabilidad
* menor latencia

---

# 8. Base de datos

Tecnología:

```
MariaDB
```

Ubicación:

```
AWS EC2
```

Separación de responsabilidades:

```
App Server
    │
    ▼
Database Server
```

Motivación:

* arquitectura realista
* mayor seguridad
* escalabilidad

---

# 9. Automatización del Active Directory

Se desarrollará un **script PowerShell** para simplificar la gestión.

Funciones previstas:

* creación de usuarios
* asignación a grupos
* gestión de OU

Ejemplo conceptual:

```powershell
New-ADUser
Add-ADGroupMember
```

Motivación:

* demostrar automatización
* facilitar administración

---

# 10. Sistema operativo del dominio

Tecnología:

```
Windows Server 2022
```

Motivación:

* versión moderna
* soporte completo
* mismas funcionalidades AD que 2019

No existen incompatibilidades relevantes para este proyecto.

---

# 11. Diagrama simplificado final

```
             ┌────────────────────────┐
             │   Red interna empresa  │
             └────────────┬───────────┘
                          │
        ┌─────────────────▼─────────────────┐
        │        Active Directory           │
        │        Windows Server 2022        │
        └───────────────┬───────────────────┘
                        │ LDAP
                        │
                        ▼
                ┌───────────────┐
                │   Internet    │
                └───────┬───────┘
                        │
                        ▼
               ┌───────────────────┐
               │  AWS LoadBalancer │
               └───────┬───────────┘
                       │
             ┌─────────▼─────────┐
             │    EC2 Docker     │
             │                   │
             │  Django 1        │
             │  Django 2        │
             │  Redis           │
             └─────────┬─────────┘
                       │
                       ▼
                 ┌──────────┐
                 │ MariaDB  │
                 └──────────┘
```

---

# 12. Decisiones técnicas clave

| Componente       | Tecnología            | Motivo                     |
| ---------------- | --------------------- | -------------------------- |
| Django           | Framework web         | desarrollo rápido          |
| Docker           | Contenerización       | despliegue reproducible    |
| MariaDB          | Base de datos         | compatibilidad con Django  |
| Redis            | sesiones              | necesario para balanceo    |
| Active Directory | identidad corporativa | autenticación centralizada |
| LDAP             | integración AD        | implementación sencilla    |
| AWS EC2          | hosting               | simulación cloud real      |
| Load Balancer    | escalabilidad         | arquitectura profesional   |
