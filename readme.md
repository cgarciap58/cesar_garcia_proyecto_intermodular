# Documentación técnica del código Python del proyecto

Este documento describe **el código propio del proyecto** (models, migraciones y vistas), sin entrar en detalles internos de Django.

## 1. Estructura funcional (visión rápida)

- `src/records/models.py`: define las entidades que se guardan en base de datos.
- `src/records/migrations/*.py`: materializa esos modelos en tablas y datos iniciales (grupos/usuarios seed).
- `src/records/views.py`: contiene la lógica de autenticación, creación de tickets, consulta y asignación.
- `src/config/urls.py`: conecta URLs con vistas.
- `src/records/templates/records/*.html`: dispara peticiones HTTP (formularios/enlaces) y presenta datos que llegan desde las vistas.

---

## 2. Cómo se agregan los modelos a la base de datos

Los modelos son objetos de Python que representan tablas en la base de datos. Para agregarlos a la base de datos, se deben crear migraciones. Las migraciones, cuando se realizan, se registran como cambios en la base de datos, y solo se ejecutan una vez.

Es decir, crear los objetos en Python es como modelar las tablas con CREATE TABLE, pero sin llegar a ejecutarlas, y las migraciones son las instrucciones para crearlas en la base de datos, o para insertar datos iniciales (para debugeo, por ejemplo).

## 2.1 Modelos declarados

En `models.py` creo un solo modelo por ahora:



### `PatientProfile` (Tabla temporal, de testeo de creacion de tablas)
- Campos:
  - `full_name` (`CharField`, máx. 255).
  - `email` (`EmailField`, único).
  - `created_at` (`DateTimeField`, auto al crear).
- Tabla explícita: `patient_profiles`.

### `Tickets` (Tabla para los tickets y su gestion)
- Campos:
  - `created_at` (`DateTimeField`, auto al crear).
  - `issue` (`TextField`).
  - `assigned_developer` (`ForeignKey` al usuario, nullable, `SET_NULL`).
  - `created_by` (`ForeignKey` al usuario, nullable, `SET_NULL`).
- Tabla explícita: `tickets`.
- Orden por defecto: más recientes primero (`-created_at`).

## 2.2 Migraciones que crean la estructura

La persistencia real se hace con migraciones versionadas:

1. `0001_initial.py`
   - Crea la tabla de `PatientProfile` (`patient_profiles`).

2. `0002_create_default_groups.py`
   - Inserta grupos base (`basic_user`, `developer`, `lead_developer`) con `RunPython`.
   - También define rollback eliminando esos grupos.

3. `0003_ticket.py`
   - Crea la tabla de tickets con FKs al modelo de usuario (`AUTH_USER_MODEL`).
   - Guarda configuración de tabla/ordenamiento.

4. `0004_create_developer_seed_users.py` y `0005_update_seed_user_credentials.py`
   - Son migraciones de datos para usuarios semilla (seed) y actualización de credenciales. (Para usuarios de prueba)

En resumen: **el modelo se define en `models.py` y se “materializa” en SQL mediante migraciones**, quedando trazabilidad por versión.

---

## 3. Cómo se conecta template -> vista -> base de datos

La aplicación usa flujo HTTP clásico de Django:

1. **Template** renderiza formulario o enlace.
2. Navegador envía request (`GET`/`POST`) a una URL.
3. `urls.py` enruta a una vista.
4. Vista ejecuta consultas ORM (`Tickets.objects...`, `User.objects...`).
5. Vista responde con HTML renderizado o JSON.

### Ejemplos concretos

## 3.1 Reportar incidente (usuario final)

- Template: `records/report_issue_form.html`
  - Formulario `POST` a `/tickets/submit/`.
  - Envía el campo `issue` + CSRF.

- URL: `path("tickets/submit/", submit_ticket_view, ...)`

- Vista: `submit_ticket_view`
  - Acepta `GET` (describe esquema del endpoint) y `POST`.
  - Lee `issue` desde `request.POST` o JSON body.
  - Si falta, devuelve error 400.
  - Si llega, crea ticket con:
    - `issue`
    - `created_by` autenticado o `None`
    - `assigned_developer=None`
  - Si viene de formulario HTML, re-renderiza el template con mensaje de éxito.
  - Si viene como API JSON, responde JSON 201.

## 3.2 Dashboard de tickets (developer o lead)

- Template: `records/index.html`
  - Si hay sesión, enlaza a `{% url 'tickets_dashboard' %}`.

- URL: `path("tickets/dashboard/", tickets_dashboard_view, ...)`

- Vista: `tickets_dashboard_view`
  - Requiere login + pertenecer a grupo `developer` o `lead_developer`.
  - `GET`:
    - Si usuario es lead: consulta todos los tickets.
    - Si no: solo tickets asignados al usuario actual.
    - Carga también lista de developers/lead para el selector.
    - Renderiza `tickets_dashboard.html` con contexto.
  - `POST` (solo lead):
    - Recibe `ticket_id` + `developer_user_id` desde el formulario del template.
    - Valida existencia de ticket y del usuario asignado.
    - Actualiza `ticket.assigned_developer` y guarda.
    - Muestra mensajes flash (`messages.success/error`) y redirige.

- Template: `records/tickets_dashboard.html`
  - Itera `tickets` para mostrarlos.
  - Si `is_lead_developer`, muestra formulario embebido de asignación por ticket.
  - Ese formulario hace `POST` al mismo endpoint del dashboard.

## 3.3 Endpoints JSON para consumo programático

- `my_assigned_tickets_view` (`/tickets/my/`, `/tickets/my_assigned/`)
  - Devuelve JSON con tickets asignados al usuario autenticado.

- `lead_ticket_management_view` (`/tickets/manage/`)
  - Solo lead developer.
  - `GET`: devuelve JSON con tickets + catálogo de developers.
  - `POST/PATCH`: asigna ticket a developer vía payload JSON o form-data.

---

## 4. Explicación de funciones en `views.py`

## Helpers internos

- `_is_developer_or_lead(user)`
  - Devuelve `True` si el usuario pertenece a `developer` o `lead_developer`.

- `_is_lead_developer(user)`
  - Devuelve `True` si pertenece a `lead_developer`.

- `_ticket_payload(ticket)`
  - Serializa una instancia de ticket a diccionario JSON estándar.

## Vistas públicas / autenticación

- `index_view(request)`
  - Página inicial (`records/index.html`).

- `login_view(request)`
  - Si ya está autenticado: redirige a dashboard.
  - Si no: usa `AuthenticationForm`; en `POST` válido inicia sesión.

- `logout_view(request)`
  - Cierra sesión y redirige al inicio.

## Vistas de reporte de incidente

- `report_issue_form_view(request)`
  - Renderiza formulario de reporte.

- `submit_ticket_view(request)`
  - Núcleo de creación de tickets.
  - Soporta cliente HTML y cliente API JSON.

## Vistas para gestión técnica

- `my_assigned_tickets_view(request)`
  - Solo developers/leads autenticados.
  - Lista en JSON los tickets asignados al usuario actual.

- `lead_ticket_management_view(request)`
  - API de gestión para líderes.
  - Permite listar y reasignar tickets con validaciones de permisos y existencia.

- `tickets_dashboard_view(request)`
  - Versión HTML de la gestión.
  - En `GET` muestra datos.
  - En `POST` permite asignación si el actor es lead.

---

## 5. Resumen del diseño

- Usas el ORM de Django para encapsular acceso a DB con modelos simples y claros.
- Separas capa HTML (templates) de capa de lógica (views).
- Tienes doble interfaz:
  - **HTML** para uso manual (dashboard/formulario).
  - **JSON** para consumo tipo API interna.
- Controlas permisos por grupos (`developer` y `lead_developer`) y login requerido.

