# GetBetter - Project Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Web Application Stack](#2-web-application-stack)
3. [Database Design](#3-database-design)
4. [AWS Architecture](#4-aws-architecture)
5. [Orchestration and Deployment Scripts](#5-orchestration-and-deployment-scripts)
6. [On-Premise Infrastructure (Windows Server)](#6-on-premise-infrastructure-windows-server)
7. [Security](#7-security)
8. [Software Development](#8-software-development)
9. [Future Improvements](#9-future-improvements)

---

## 1. Project Overview

**GetBetter** is a SaaS (Software as a Service) web platform designed for psychological clinics. It connects psychologists with their patients in a professional and structured digital environment.

The platform allows psychologists to manage their availability by publishing appointment slots, and allows patients to browse those slots and request bookings. Psychologists can confirm, reject, or cancel appointments, and maintain private clinical notes per session alongside notes visible to the patient. Each psychologist profile includes a professional license number that must be verified by an administrator before they can begin managing appointments.

The long-term vision for the product is to specialise in patients dealing with **behavioural addictions**, a field that is underserved by generic medical appointment platforms. The architecture and data model have been designed to be extensible in that direction, particularly with respect to patient monitoring, session history, and the potential for third-party integrations such as video calls and payment processing.

The platform is bilingual (Spanish and English) to serve both Spanish-speaking clinical professionals and an international audience.

---

## 2. Web Application Stack

The application is a modern fullstack web application composed of the following services, each running on **Debian Linux** hosts within AWS EC2 instances.

### Frontend: Nginx serving a ReactJS build

The user interface is built with **ReactJS**, a JavaScript library developed by Meta for building component-based single-page applications (SPAs). During development, the React development server is used directly. For production, the React source code is compiled into a set of static files (HTML, CSS, and JavaScript bundles) using `npm run build`. These static files are then served by **Nginx**, a high-performance web server.

Nginx on the application node does double duty: it serves the static React build for all non-API routes, and it acts as a **reverse proxy** for any request that begins with `/api/`, `/admin/`, or `/static/`, forwarding those to the Django backend running locally in the same container stack.

### Backend: Django via Gunicorn

The backend is a **Django** application (Python web framework). Django handles all business logic, user authentication, data validation, and exposes a REST API that the React frontend consumes. Django does not serve web pages directly in this architecture; it only responds to API calls.

Django runs inside a Docker container via **Gunicorn**, a production-grade Python WSGI (Web Server Gateway Interface) HTTP server. Gunicorn listens on port 8000 inside the container. Nginx proxies relevant requests to it.

### Database: MariaDB

Persistent relational data is stored in **MariaDB**, an open-source relational database that is a community-maintained fork of MySQL. It runs on a dedicated private EC2 instance. Only the application nodes are allowed to connect to it, enforced at the network level via Security Groups.

### Cache and Session Store: Redis

**Redis** is an in-memory key-value data store used here for two purposes. First, it stores Django user **sessions**: when a user logs in, Django stores their session data in Redis instead of the database, which is significantly faster for read-heavy operations. Second, it serves as a general-purpose **cache** backend. Redis runs on its own dedicated private EC2 instance and is protected so that only application nodes can reach it.

When Redis is available (`USE_REDIS=True` in the environment), Django is configured to use `django_redis` as its cache backend and `django.contrib.sessions.backends.cache` as its session engine. When running locally without Redis, Django falls back to local memory cache and database sessions.

### Persistent Image Storage: AWS S3

User-uploaded images (profile pictures) are stored in an **AWS S3** bucket rather than on the local filesystem. This is essential in a multi-node setup: if a user uploaded a file to App Node 1 and their next request was routed to App Node 2, the file would not be there. S3 provides a single, shared, durable storage location accessible by all application nodes. Django is configured with `boto3` and `storages` to handle file uploads transparently to S3 when `AWS_S3=True`.

### Summary Table

| Layer | Technology | Host |
|---|---|---|
| Frontend | Nginx + ReactJS (static build) | App EC2 (Docker) |
| Backend | Django + Gunicorn | App EC2 (Docker) |
| Reverse Proxy (per node) | Nginx | App EC2 (Docker) |
| Load Balancer | Nginx | LB EC2 |
| Database | MariaDB | DB EC2 (private subnet) |
| Session / Cache | Redis | Redis EC2 (private subnet) |
| File Storage | AWS S3 | AWS managed service |
| Operating System | Debian Linux | All EC2 instances |
| Containerisation | Docker + Docker Compose | App EC2 instances |

---

## 3. Database Design

### Django and the ORM

Django uses an **ORM (Object-Relational Mapper)**, which means you define your database tables as Python classes called **Models**. When you run `python manage.py makemigrations` followed by `python manage.py migrate`, Django translates those Python class definitions into actual SQL `CREATE TABLE` statements and applies them to the database. You never have to write raw SQL to create or modify tables.

This is one of Django's most powerful features for junior developers: the database schema is version-controlled alongside the application code, and changes to models produce **migration files** that can be applied, reversed, and shared with the team.

### The Data Models

The application is divided into two Django apps: `accounts` (users and profiles) and `appointments` (slots and bookings).

#### `accounts` app

**`User`** (extends Django's built-in `AbstractUser`)

This is the central user table. Every person who logs into the system has a row here, regardless of whether they are a patient or a psychologist.

| Field | Type | Description |
|---|---|---|
| `id` | BigAutoField (PK) | Auto-incrementing primary key |
| `email` | EmailField (unique) | Used as login identifier |
| `username` | CharField (unique) | Django built-in, set to email on creation |
| `first_name` | CharField | Given name |
| `last_name` | CharField | Family name |
| `role` | CharField (choices) | Either `patient` or `psychologist` |
| `dob` | DateField | Date of birth |
| `city` | CharField | City of residence |
| `phone_number` | CharField | Optional contact number |
| `profile_picture` | ImageField | Stored in S3 or local media |
| `timezone` | CharField | User's local timezone (e.g. `Europe/Madrid`) |
| `password` | CharField | Stored as a secure hash, never plaintext |

**`PatientProfile`** (OneToOne with User)

An extension of the user record that holds patient-specific information. The `OneToOneField` means each `User` with role `patient` has exactly one `PatientProfile`, and deleting the user cascades to delete the profile.

| Field | Type | Description |
|---|---|---|
| `user` | OneToOneField(User) | Links back to the user |
| `concerns` | TextField | Patient's stated concerns or reason for seeking help |
| `credits` | PositiveIntegerField | Session credits (for future payment integration) |

**`PsychologistProfile`** (OneToOne with User)

Holds professional information specific to psychologists.

| Field | Type | Description |
|---|---|---|
| `user` | OneToOneField(User) | Links back to the user |
| `license_number` | CharField (unique) | Official professional registration number |
| `specialty` | CharField | Area of specialisation |
| `is_verified` | BooleanField | Set to `True` by an admin after verification |
| `verification_status` | CharField (choices) | `pending`, `approved`, or `rejected` |
| `session_duration_minutes` | PositiveIntegerField | Default session length (e.g. 50 or 55 minutes) |
| `session_price` | DecimalField | Price per session |

#### `appointments` app

**`AvailableSlot`** (linked to PsychologistProfile)

Psychologists create time slots indicating when they are available. Each slot belongs to one psychologist via a `ForeignKey`. The `related_name='available_slots'` means you can write `psychologist_profile.available_slots.all()` in Python to get all slots for a given psychologist.

| Field | Type | Description |
|---|---|---|
| `id` | BigAutoField (PK) | Auto-incrementing primary key |
| `psychologist` | ForeignKey(PsychologistProfile) | The psychologist who owns the slot |
| `start_time` | DateTimeField | When the session begins (timezone-aware) |
| `duration_minutes` | PositiveIntegerField | Length of the session |
| `status` | CharField (choices) | `open`, `confirmed`, or `deleted` |
| `created_at` | DateTimeField (auto) | When the slot was created |

**`Appointment`** (linked to AvailableSlot and PatientProfile)

A booking request made by a patient for a slot. Multiple patients can request the same open slot; the psychologist then confirms one and the others remain as pending or get rejected.

| Field | Type | Description |
|---|---|---|
| `id` | BigAutoField (PK) | Auto-incrementing primary key |
| `slot` | ForeignKey(AvailableSlot) | The slot being booked |
| `patient` | ForeignKey(PatientProfile) | The patient who made the request |
| `status` | CharField (choices) | `pending_request`, `confirmed`, `rejected`, or `cancelled` |
| `private_notes` | TextField | Clinical notes visible only to the psychologist |
| `patient_notes` | TextField | Notes visible to both parties |
| `meet_link` | URLField | Optional video call link (e.g. Google Meet) |
| `created_at` | DateTimeField (auto) | When the booking was made |
| `updated_at` | DateTimeField (auto) | Last update timestamp |

A `UniqueConstraint` ensures a patient cannot have more than one active (`pending_request` or `confirmed`) booking for the same slot, preventing duplicate requests.

### Relationship Diagram

```
User (1) <----OneToOne----> PatientProfile (1)
User (1) <----OneToOne----> PsychologistProfile (1)

PsychologistProfile (1) <----ForeignKey----> AvailableSlot (many)

AvailableSlot (1) <----ForeignKey----> Appointment (many)
PatientProfile (1) <----ForeignKey----> Appointment (many)
```

### Example: A Complete Booking Flow in the Database

1. **Dra. Elena Martinez** signs up. A `User` row is created with `role=psychologist`. A `PsychologistProfile` row is created linked to that user with `verification_status=pending`.

2. An admin verifies her license. The `PsychologistProfile` row is updated: `is_verified=True`, `verification_status=approved`.

3. Elena creates a slot for next Tuesday at 10:00. An `AvailableSlot` row is created with `status=open`, linked to her `PsychologistProfile`.

4. **Sofía Navarro** (a patient) requests that slot. An `Appointment` row is created with `status=pending_request`, linking Sofía's `PatientProfile` to Elena's `AvailableSlot`.

5. Elena confirms the booking. The `Appointment` row is updated to `status=confirmed`. The `AvailableSlot` row is updated to `status=confirmed`.

6. After the session, Elena writes her clinical notes. The `Appointment` row is updated with content in `private_notes`.

In raw SQL terms, a query to find all confirmed upcoming appointments for a specific psychologist would look like:

```sql
SELECT u.first_name, u.last_name, s.start_time, a.patient_notes
FROM appointments_appointment a
JOIN appointments_availableslot s ON a.slot_id = s.id
JOIN accounts_patientprofile pp ON a.patient_id = pp.id
JOIN accounts_user u ON pp.user_id = u.id
JOIN accounts_psychologistprofile psy ON s.psychologist_id = psy.id
WHERE psy.user_id = 42
  AND a.status = 'confirmed'
  AND s.start_time > NOW()
ORDER BY s.start_time ASC;
```

In Django's ORM, the same result is expressed as:

```python
Appointment.objects.filter(
    slot__psychologist__user=request.user,
    status='confirmed',
    slot__start_time__gt=timezone.now()
).select_related('patient__user', 'slot').order_by('slot__start_time')
```

### The Django Admin Panel

Django ships with a built-in administration interface available at `/admin/`. Once a user is granted `is_staff=True` (or `is_superuser=True`), they can log into this panel and interact with all registered models through a graphical interface, without writing any SQL or code.

Through the admin panel, site administrators can:

- View, search, filter, create, update, and delete any database record
- Verify psychologist accounts by setting `is_verified=True` and `verification_status=approved`
- Inspect appointment history and statuses for any patient or psychologist
- Manage user accounts, reset passwords, and control staff permissions
- Monitor the seed demo data loaded via `python manage.py seed_demo`

The admin panel is particularly valuable during early deployment for manual data management and testing before self-service workflows are fully built out on the frontend.

### Database Utilities

**`utils/backup_db.sh`**

This Bash script produces a compressed SQL dump of the MariaDB database. It operates in two modes:

- `./utils/backup_db.sh local` - runs `mariadb-dump` inside the local Docker container and compresses the output with `gzip`, saving the file to `backups/` with a timestamp in the filename.
- `./utils/backup_db.sh cloud` - connects to the production database server via SSH through the Bastion host, runs `mariadb-dump` on the remote machine, streams the output back over SSH, and compresses it locally. The script requires no database password when running in cloud mode because MariaDB on the EC2 instance is configured for socket authentication for the root user.

Backup files are named in the format `getbetterDB_YYYY-MM-DD_HH-MM-SS_mode.sql.gz` and are excluded from version control via `.gitignore`.

**`utils/read_or_unzip_backups.sh`**

A small interactive utility that accepts a `.sql.gz` backup file as an argument and offers two options: reading the contents directly in the terminal (using `zcat`) without decompressing to disk, or decompressing the file to a `.sql` file alongside the original (using `gunzip -k` to keep the original).

---

## 4. AWS Architecture

### Virtual Private Cloud (VPC)

The entire infrastructure lives inside a single **VPC** (Virtual Private Cloud) named `VPC GetBetter`, with CIDR block `10.0.0.0/24`. A VPC is a logically isolated section of the AWS network. No traffic enters or leaves the VPC unless explicitly allowed by routing rules, Security Groups, and Network ACLs.

### Subnets

The VPC is divided into four subnets, each serving a distinct security zone:

**Subnet DMZ (public) - `10.0.0.0/26`**

This is the only subnet reachable from the public internet. It contains the **Load Balancer** EC2 instance, which is the single entry point for all user traffic, and the **NAT Gateway**, which allows instances in private subnets to initiate outbound connections (e.g. for package installation or git clone) without being reachable from the internet themselves.

**Subnet App (private) - `10.0.0.64/26`**

Contains the application nodes (App1 and App2), the Redis instance, and the S3 interface. Instances here have no public IP address. They receive traffic only from the Load Balancer via its Security Group.

**Subnet DB (private) - `10.0.0.128/26`**

Contains the MariaDB instance. No public IP, no direct internet access. Only the application nodes are permitted to connect on port 3306.

**Subnet Admin (public) - `10.0.0.192/26`**

Contains the **Bastion host**. This is a hardened EC2 instance used exclusively as an SSH jump point for administrative access. Administrators connect to the Bastion from their own IP, then SSH onward from the Bastion to any private instance. The Bastion has a public IP and accepts SSH only from whitelisted administrator addresses.

### Traffic Flow

```
Internet (HTTPS port 443)
        |
        v
Internet Gateway
        |
        v
Load Balancer (Subnet DMZ, public)
  - Nginx with SSL termination via Certbot / Let's Encrypt
  - upstream: least_conn algorithm across App1 and App2
  - Forwards HTTP internally to App1:80 or App2:80
        |
        v (HTTP port 80 to private subnet)
App Node (Subnet App, private)
  - Nginx container: serves React static files, proxies /api/ to Django
  - Django container (Gunicorn): processes API requests
  - Reads/writes sessions via Redis (port 6379)
  - Reads/writes persistent data via MariaDB (port 3306)
  - Reads/writes images via AWS S3 (HTTPS, outbound via NAT Gateway)
```

The Load Balancer uses Nginx's `least_conn` upstream algorithm, which directs each new connection to whichever backend node currently has the fewest active connections. This distributes load evenly under varying request times.

### Scalability

The architecture is horizontally scalable by design. The application layer is stateless: all session data lives in Redis (shared by both nodes), all file uploads go to S3, and all persistent data is in MariaDB. This means a new application node can be added at any time by:

1. Spinning up a new EC2 instance in the App subnet
2. Running `app_setup.sh` on it
3. Running `app_deploy.sh` on it
4. Adding its private IP to the Load Balancer's Nginx upstream block using `update_lb.sh`

No downtime is required, and no data needs to be migrated. The `setup_or_deploy_EC2_aws.sh` script supports an arbitrary number of `APP_IP_N` entries in the configuration map, and will loop over all of them for bulk operations.

The database and Redis can be scaled independently (vertically by resizing the EC2 instance, or horizontally by migrating to read replicas or Redis Cluster respectively) without touching the application code.

### Security Groups and Network ACLs

**Security Groups** act as stateful virtual firewalls at the instance level. Each instance belongs to one or more Security Groups, and each group defines what inbound and outbound traffic is permitted.

- **SG LB**: accepts HTTPS (443) from anywhere (`0.0.0.0/0`) and SSH (22) from the Bastion SG only.
- **SG App**: accepts HTTP (80) from SG LB only, and SSH (22) from SG Bastion only.
- **SG Redis**: accepts port 6379 from SG App only.
- **SG DB**: accepts port 3306 from SG App only.
- **SG Bastion**: accepts SSH (22) from administrator IPs only.

**Network ACLs (NACLs)** are stateless firewall rules applied at the subnet level, providing a second layer of access control independently of Security Groups. NACLs evaluate rules in numerical order and provide an explicit allow/deny mechanism for traffic crossing subnet boundaries, complementing the instance-level Security Groups.

This layered approach means that even if a Security Group were misconfigured, the NACL would still enforce subnet-level boundaries, and vice versa.

---

## 5. Orchestration and Deployment Scripts

All deployment scripts are located in the `deployment/` directory. They are designed to be run from the administrator's local machine, connecting to EC2 instances remotely over SSH via the Bastion host.

### Environment Configuration

Before any script can run, the administrator must populate two key files:

- `deployment/.aws-map.env` - maps logical names to actual IP addresses and hostnames of all EC2 instances, plus the path to the SSH key file.
- `app/.app.base.env` and `app/.app.aws.env` - hold application-level environment variables (database credentials, Redis password, Django secret key, S3 bucket details, etc.).

These files are excluded from version control for security reasons.

### `deployment/setup_or_deploy_EC2_aws.sh`

This is the **master orchestration script**. It is the single entry point for all setup and deployment operations. When executed, it presents an interactive menu allowing the administrator to choose which component to act on: Bastion, Load Balancer, Database, Redis, or one or more App nodes.

For each component, it offers sub-options: either a full setup (for a fresh EC2 instance) or a targeted update (e.g. updating only the upstream IPs on the Load Balancer). It reads the topology from `.aws-map.env`, establishes SSH connections via the Bastion using `ProxyJump`, and pipes the appropriate sub-script to the remote machine for execution. Sensitive environment variables are assembled locally into a temporary file, transferred via `scp` through the Bastion, and cleaned up after use.

### `deployment/lb/lb_setup.sh`

Configures a fresh Debian EC2 instance as the Nginx Load Balancer. It sets the hostname, installs Nginx and Certbot, generates an Nginx configuration with an upstream block pointing to all app node IPs (using the `least_conn` algorithm), and provisions a free TLS/SSL certificate from Let's Encrypt via Certbot, configuring automatic HTTPS redirection.

### `deployment/lb/update_lb.sh`

Updates only the upstream block of an already-configured Load Balancer. This is the script to run when adding or removing application nodes. It rewrites the upstream section of the Nginx config in-place using `awk`, creates a timestamped backup of the previous config, validates the new config with `nginx -t`, and reloads Nginx without downtime using `systemctl reload nginx`.

### `deployment/db/db_setup.sh`

Configures a fresh Debian EC2 instance as the MariaDB database server. It installs MariaDB, creates the application database, and creates a database user for each application node IP (since MariaDB's user system includes the origin IP in the credential), granting that user full privileges on the application database. It also configures MariaDB to listen on all interfaces (`0.0.0.0`) so that app nodes in the private subnet can connect.

### `deployment/redis/redis_setup.sh`

Configures a fresh Debian EC2 instance as the Redis server. It installs Redis, configures it to listen on all interfaces, enables AOF (Append-Only File) persistence so that session data survives a restart, sets a password, and restarts the service.

### `deployment/app/app_setup.sh`

Prepares a fresh Debian EC2 instance to host the application. It sets the hostname, updates the system, and installs Docker and Docker Compose using the official Docker installation procedure for Debian. It also installs Git. This script only installs dependencies; it does not clone the repository or start any containers.

### `deployment/app/app_deploy.sh`

Deploys the application onto a previously set-up app node. It clones the repository if not already present (or runs `git pull` to update it), removes deployment and local infrastructure directories that are not needed in production, retrieves the `.env.runtime` file from `/tmp/` (where `setup_or_deploy_EC2_aws.sh` placed it via `scp`), stops any running containers, prunes unused Docker images, and starts the application stack with `docker compose up -d --build`.

### `deployment/bastion/bastion_setup.sh`

Sets the hostname on the Bastion host and performs basic hardening steps. The Bastion's primary role is to be a controlled SSH gateway; this script ensures it is properly identified within the network.

### `deployment/jump_to_EC2_aws.sh`

A convenience utility for administrators. It presents an interactive menu of all EC2 instances in the topology and opens a direct interactive SSH session to the chosen machine, automatically routing through the Bastion using `ProxyJump` and loading the SSH key into `ssh-agent`.

---

## 6. On-Premise Infrastructure (Windows Server)

*This section will be expanded separately. The following is a structural overview.*

### Overview

In parallel with the AWS cloud infrastructure, the project includes an on-premise Windows Server 2022 deployment representing the corporate IT environment of a psychological clinic. This hybrid architecture connects to the AWS application layer via **Tailscale**, a zero-configuration VPN overlay network, allowing the Django application to query the on-premise Active Directory for employee authentication.

### Services Running on Windows Server 2022

**Active Directory Domain Services (AD DS)**

The Windows Server acts as the Domain Controller for the clinic's internal network. It maintains the authoritative directory of all corporate users (e.g. administrative staff, psychologists employed directly by the clinic). The domain provides a centralised identity management system.

**DHCP (Dynamic Host Configuration Protocol)**

The DHCP server role is configured on Windows Server to automatically assign IP addresses, subnet masks, default gateways, and DNS server addresses to client machines joining the domain network. This eliminates the need for manual network configuration on each workstation.

**DNS (Domain Name System)**

Windows Server hosts the internal DNS zone for the clinic's domain. It resolves internal hostnames (e.g. `fileserver.clinic.local`) for domain-joined machines, and forwards external DNS queries to an upstream resolver. The Active Directory infrastructure depends on DNS to function.

**FTP (File Transfer Protocol)**

An FTP service is configured to provide a controlled file transfer endpoint for the clinic's internal network. This supports scenarios such as transferring documents between departments or backing up files from workstations to a central location.

### Active Directory Configuration

**Users and Groups**

User accounts are created in Active Directory for all clinic employees. Users are organised into security groups that reflect their role in the organisation (e.g. `Psychologists`, `Administrative Staff`, `IT Administrators`). Group membership determines what resources and permissions each user has on the network and, via LDAP integration, within the GetBetter application itself.

**Group Policy Objects (GPOs)**

GPOs are used to enforce a consistent and secure desktop environment across all domain-joined Windows workstations. Policies applied include:

- A **corporate desktop configuration** GPO that sets wallpapers, restricts access to system settings, and enforces a standard start menu layout appropriate for a clinical environment.
- A **PowerShell execution restriction** GPO that blocks users from running PowerShell scripts, reducing the attack surface for scripting-based threats on end-user machines.

### Django LDAP Integration

The Django application queries Active Directory over LDAP (via Tailscale) to authenticate employees. When a clinic employee attempts to log in, Django checks the credential against Active Directory rather than the local database. If authentication succeeds, Django creates or updates a local user session. External patients continue to authenticate exclusively against the MariaDB database.

---

## 7. Security

### Overview

GetBetter handles sensitive personal and clinical data. The platform operates under two principal regulatory frameworks that impose specific technical and organisational security obligations: the **General Data Protection Regulation (GDPR)** and the **Esquema Nacional de Seguridad (ENS)**, Spain's national security framework for information systems.

### Risk Analysis

The primary assets requiring protection are:

- **Patient identities and personal data** (name, date of birth, contact details)
- **Clinical session notes** (especially `private_notes`, which are strictly confidential)
- **Authentication credentials** (passwords, session tokens)
- **Psychologist license and professional data**

The principal threat vectors are:

- Unauthorised access to the database from the internet
- Interception of data in transit
- Credential compromise via brute force or phishing
- Insider access beyond least-privilege boundaries
- Physical access to server hardware

### Layered Network Security

**Availability zones and redundancy**: The application runs across two independent App nodes. A failure of one node results in the Load Balancer automatically routing all traffic to the surviving node. Deploying nodes in separate AWS availability zones provides physical isolation against datacenter-level failures, ensuring the platform remains operational even during partial infrastructure outages.

**Private subnets**: The database and Redis instances have no public IP addresses and are unreachable from the internet. They can only receive connections from application nodes within the same VPC.

**Security Groups**: Every EC2 instance has a dedicated Security Group that allows only the minimum necessary inbound traffic. The database accepts connections only from the application nodes' IPs. Redis accepts connections only from the application nodes. The Load Balancer accepts HTTPS from anywhere but SSH only from the Bastion.

**Network ACLs**: A second, stateless layer of access control applied at the subnet boundary, providing defence-in-depth independent of Security Group configuration.

**Bastion host**: No EC2 instance in a private subnet is accessible directly from the internet. All administrative SSH access flows through the Bastion, which is the only public-facing administrative endpoint. This concentrates the attack surface for administrative access to a single, monitored point.

**TLS/SSL in transit**: All traffic between end users and the Load Balancer is encrypted via HTTPS, with a TLS certificate provisioned by Let's Encrypt. Internal traffic between the Load Balancer and app nodes travels over the private VPC network, which is isolated from the public internet.

### Data Protection

**Hashed passwords**: Django's authentication framework never stores passwords in plaintext. Passwords are hashed using PBKDF2 with SHA-256 by default, with multiple rounds of iteration, before being stored in the database. Even a full database compromise would not expose raw passwords.

**Access control at the application layer**: The Django REST API enforces authentication and authorisation on every endpoint. Patients can only see their own appointments. Psychologists can only see slots and appointments linked to their own profile. Private clinical notes are never returned in API responses sent to patients.

**GDPR relevance**: The platform collects and processes personal data (identity, date of birth, health-related session data). Under GDPR, this constitutes special category data, requiring explicit consent, data minimisation, the right to erasure, and appropriate technical safeguards. The architecture supports these requirements through controlled access, encrypted transit, and the ability to delete user records.

**ENS relevance**: As a platform potentially used by public health-adjacent professionals in Spain, adherence to the Esquema Nacional de Seguridad is relevant. The ENS mandates controls around access management, audit logging, incident response, and continuity planning, many of which are addressed by the architecture described in this document and will be further developed in future iterations.

---

## 8. Software Development

### Django (Python)

Django is a high-level Python web framework that follows the **MTV (Model-Template-View)** pattern. In this project, the Template layer is not used (React handles all UI rendering), but the Model and View layers are central.

**Models** define the database schema as Python classes. **Views** (more accurately called ViewSets or API Views in the context of Django REST Framework) handle incoming HTTP requests, apply business logic, interact with models, and return JSON responses to the React frontend.

Django's settings file (`core/settings.py`) demonstrates a mature configuration pattern: all sensitive values (database credentials, secret key, Redis password, S3 keys) are read from environment variables using the `django-environ` library. This means the same codebase can run locally against SQLite without Redis or S3, and in production against MariaDB, Redis, and S3, simply by changing the environment file.

Django enforces four password validators by default (similarity to username, minimum length, common password list, numeric-only check), ensuring a baseline of password quality at the application level.

### ReactJS

React is a JavaScript library for building component-based user interfaces. Instead of the server rendering HTML on each request (as Django templates would), React runs entirely in the browser. On first load, Nginx delivers the compiled JavaScript bundle. React then manages all navigation, state, and rendering on the client side, communicating with the Django backend exclusively through API calls.

This architecture produces a fast, responsive user experience because page transitions do not require a full server round-trip.

**Key React concepts used in this project:**

- `useState` and `useEffect` hooks for managing component-level state and side effects
- React Router for client-side navigation between pages (login, signup, dashboard, profile, appointments)
- `Context API` (`AuthContext`) for sharing authentication state (the logged-in user object) across the entire component tree without prop drilling
- Custom service functions that wrap `fetch` calls to the Django API

### i18n (Internationalisation)

The frontend uses the `react-i18next` library to support multiple languages. All user-facing text strings are externalised into JSON locale files under `src/i18n/locales/`, organised by language code (`en/`, `es/`) and then by feature (`auth.json`, `profile.json`, `common.json`, etc.).

For example, the signup form's field labels, validation messages, and button text are all stored in locale files. When the user or browser selects a language, `useTranslation('auth')` returns a `t` function that resolves any key to the appropriate string in the active language. Adding a new language requires only a new locale folder and JSON files, with no changes to component code.

This is important for a platform serving both Spanish clinical professionals and international users.

### Client-Side Validation

Input validation occurs at two levels: the frontend (React) and the backend (Django). Client-side validation provides immediate feedback to the user before any network request is made.

The validation logic in `src/utils/validate.js` defines:

- **Regular expressions** for names (letters, hyphens, spaces, apostrophes, including accented Spanish characters), email format, and phone numbers.
- **Live keystroke filters** (`filterName`, `filterEmail`, `filterPhone`) that silently strip invalid characters as the user types, preventing invalid input from being entered at all.
- **Age validation** (`isOldEnough`) that calculates whether a date of birth represents someone aged 16 or older.
- **`validateSignUpValues`** which runs all field checks and returns an errors object keyed by field name. If the object is non-empty, the form is not submitted.

Validation messages are passed through `t()` so they too are localised.

Backend validation is performed independently in Django's serializers and views, ensuring security even if the frontend were bypassed.

### Pre-loading GIF

While the React JavaScript bundle is being parsed and the application is initialising, the initial HTML file (served by Nginx) displays a loading indicator. This prevents the user from seeing a blank page during the brief initialisation period. Once React mounts and the application is ready, the loading indicator is replaced by the actual interface.

### Hashed Passwords at Signup

When a user submits the signup form, the raw password is sent over HTTPS to the Django API endpoint. Django's `create_user()` method (or the serializer's `create()` method) calls `set_password()`, which hashes the password using Django's configured hasher (PBKDF2-SHA256 by default) before writing it to the database. The raw password is never logged or persisted anywhere.

### Bash Scripting

All infrastructure automation is written in **Bash**. The scripts follow defensive practices: `set -euo pipefail` at the top of every script ensures the script stops immediately on any error (`-e`), treats unset variables as errors (`-u`), and propagates pipe failures correctly (`-o pipefail`). Environment variables are loaded using `source` with inline-comment stripping to avoid common parsing issues. SSH agent forwarding allows key-based authentication to chain through Bastion to private instances without exposing private key files on remote machines.

---

## 9. Future Improvements

### Security and Compliance

- **Penetration testing**: Commission a structured penetration test of the deployed application and infrastructure to identify vulnerabilities before a wider rollout. Address findings and retest.
- **GDPR compliance audit**: Formalise a data processing register, implement explicit consent flows for data collection, add a right-to-erasure mechanism in the admin panel and potentially the user's own profile, and produce a privacy policy.
- **ENS compliance**: Conduct a formal gap analysis against the Esquema Nacional de Seguridad baseline controls. Implement mandatory audit logging of all access to clinical data, establish an incident response procedure, and document a business continuity plan.
- **WAF and DDoS protection**: Deploy a Web Application Firewall (AWS WAF) in front of the Load Balancer to detect and block common attack patterns (SQL injection, XSS, request floods).

### Payment Integration (Stripe)

Integrate the **Stripe** payment API to allow patients to purchase session credits, and to process payments when confirming a booking. The `credits` field on `PatientProfile` and the `session_price` field on `PsychologistProfile` are already present in the data model, providing the foundation for this feature. A Stripe webhook endpoint would be added to Django to handle asynchronous payment confirmation.

### Video Call Integration (Google Meet API)

The `Appointment` model already has a `meet_link` field. Integrating the **Google Meet API** (or a similar provider) would allow Django to automatically generate a unique video call link when an appointment is confirmed and populate this field, eliminating the need for the psychologist to manually create and share a link.

### OAuth (Social Sign-In)

Add OAuth-based authentication (Google, Microsoft) using `django-allauth` or `social-django`. This would allow patients to create accounts and log in using their existing Google or Microsoft accounts, reducing registration friction. This is particularly useful if Microsoft OAuth is configured to allow clinic employees to authenticate with their existing corporate Microsoft accounts.

### AWS Native Load Balancing (ALB)

Replace the manually configured Nginx Load Balancer EC2 instance with **AWS Application Load Balancer (ALB)**. ALB is a fully managed service that provides automatic health checks, cross-availability-zone load balancing, SSL termination, and native integration with AWS services such as WAF, Certificate Manager, and Auto Scaling. This would eliminate the need to manage an EC2 instance for load balancing and increase reliability.

### DNS Management (Route 53)

Replace the current DDNS-based domain resolution (`getbetter.ddns.net`) with **AWS Route 53**, Amazon's managed DNS service. Route 53 provides reliable, low-latency DNS resolution, health-check-based routing, and native integration with ALB and other AWS services. A proper domain would be registered and managed through Route 53.

### Patient Monitoring Application

Develop a supplementary mobile or web application that allows a patient's designated psychologist to passively monitor selected behavioural indicators reported by the patient (similar in concept to parental control monitoring, but consent-based and therapeutically oriented). This application would feed data into the main GetBetter platform, giving psychologists a richer longitudinal view of a patient's behaviour patterns between sessions. This is the feature most directly aligned with the platform's specialisation focus on behavioural addictions, where between-session behaviour data is clinically significant.
