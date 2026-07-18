# TallerPro — Sistema de Gestión de Taller Mecánico

## Descripción general

TallerPro es una aplicación web multi-tenant para la gestión integral de talleres mecánicos. Permite administrar clientes, vehículos, órdenes de trabajo y catálogo de servicios desde una interfaz moderna, con autenticación propia y aislamiento completo de datos por taller.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript 5.8 |
| UI | React 19 + lucide-react |
| Estilos | CSS custom (`app/globals.css`) — sin Tailwind |
| Base de datos | PostgreSQL 16 — driver `pg` directo, sin ORM |
| Migraciones | Auto-gestionadas con funciones `ensure*()` en `lib/db.ts` |
| Autenticación | Sesiones JWT firmadas con `AUTH_SECRET` via `jose` (sin NextAuth) |
| Contraseñas | `bcryptjs` |
| Multi-tenant | Toda la data aislada por `taller_id` |
| Infra | VPS Linux + Docker + docker-compose |
| CI/CD | GitHub Actions — push a `main` dispara deploy vía SSH |

---

## Arquitectura

```
taller_mecanico/
├── app/
│   ├── api/                          → Route Handlers REST (Next.js App Router)
│   │   ├── auth/login                → POST — login con email/password
│   │   ├── auth/logout               → POST — cierre de sesión
│   │   ├── auth/session              → GET  — sesión activa
│   │   ├── clientes/                 → GET, POST
│   │   ├── clientes/[id]/            → PUT, DELETE
│   │   ├── vehiculos/                → GET, POST
│   │   ├── vehiculos/[id]/           → PUT, DELETE
│   │   ├── ordenes-trabajo/          → GET, POST
│   │   ├── ordenes-trabajo/[id]/     → PUT, DELETE
│   │   ├── ordenes-trabajo/[id]/servicios/           → GET, POST
│   │   ├── ordenes-trabajo/[id]/servicios/[svcId]/   → DELETE
│   │   ├── servicios/                → GET, POST
│   │   └── servicios/[id]/           → PUT, DELETE
│   ├── dashboard/page.tsx            → Inicio con estadísticas reales
│   ├── clientes/                     → Módulo CRUD clientes
│   ├── vehiculos/                    → Módulo CRUD vehículos
│   ├── ordenes-trabajo/              → Módulo CRUD órdenes + servicios
│   ├── servicios/                    → Mantenedor de catálogo de servicios
│   ├── login/page.tsx                → Login con usuarios de prueba
│   ├── app-shell.tsx                 → Layout + sidebar + navegación
│   ├── layout.tsx                    → Root layout
│   └── globals.css                   → Sistema de diseño completo
├── lib/
│   ├── db.ts                         → Pool pg + tipos + ensure*() + initDB()
│   └── api-session.ts                → Helpers JWT: createSession / getSession / deleteSession
├── proxy.ts                          → Protección de rutas (Next.js 16, reemplaza middleware.ts)
├── .env.local                        → DATABASE_URL + AUTH_SECRET
├── Dockerfile
├── docker-compose.yml
└── .github/workflows/deploy.yml      → CI/CD
```

---

## Modelo de datos

```
talleres
  id, nombre

usuarios
  id, taller_id → talleres
  nombre, email, password_hash, rol (admin | mecanico | recepcion), activo

clientes
  id, taller_id → talleres
  nombre, rut, email, telefono

vehiculos
  id, taller_id → talleres, cliente_id → clientes
  patente, marca, modelo, anio, color

ordenes_trabajo
  id, taller_id → talleres, vehiculo_id → vehiculos
  descripcion, estado (pendiente | en_progreso | completada | entregada)
  km_ingreso, costo_total, created_at, updated_at

servicios
  id, taller_id → talleres
  nombre, descripcion, precio_base, activo

ordenes_trabajo_servicios  ← tabla pivot
  id, orden_id → ordenes_trabajo (CASCADE), servicio_id → servicios (CASCADE)
  precio_aplicado
  UNIQUE(orden_id, servicio_id)
```

---

## Módulos del sistema

### Dashboard `/dashboard`
Vista de inicio con estadísticas en tiempo real: órdenes activas, total de clientes y vehículos registrados. Los conteos se calculan server-side en el Server Component.

### Órdenes de trabajo `/ordenes-trabajo`
CRUD completo de órdenes. Cada orden se vincula a un vehículo (y por transitividad al cliente). Incluye:
- Estado con badge visual: Pendiente · En progreso · Completada · Entregada
- Kilometraje de ingreso
- Sección de **servicios asignados**: permite agregar/quitar servicios del catálogo con auto-cálculo del costo total
- Costo total editable manualmente o calculado desde los servicios

### Clientes `/clientes`
Registro de clientes del taller con nombre, RUT, email y teléfono.

### Vehículos `/vehiculos`
Registro de vehículos vinculados a un cliente. Campos: patente (forzada a mayúsculas), marca, modelo, año y color.

### Servicios `/servicios`
Catálogo de servicios que ofrece el taller (Ej: Cambio de aceite, Revisión de frenos). Cada servicio tiene nombre, descripción, precio base y estado activo/inactivo. Solo los servicios activos aparecen disponibles para asignar a órdenes.

---

## Autenticación y seguridad

- Login con email + password (bcrypt hash en DB)
- Sesión JWT firmada con HS256, cookie HTTP-only `taller_session`, expiración 8 horas
- Protección de rutas con `proxy.ts` (Next.js 16) — redirige a `/login` si no hay sesión
- Roles: `admin`, `mecanico`, `recepcion`
- Multi-tenant: **toda query filtra por `taller_id`**, nunca hay fuga de datos entre talleres

### Usuarios de prueba (seed automático)

| Email | Contraseña | Rol |
|-------|-----------|-----|
| admin@taller.com | admin123 | Administrador |
| mecanico@taller.com | mec123 | Mecánico |
| recepcion@taller.com | rec123 | Recepción |

---

## Migraciones de base de datos

No hay herramienta de migración externa. Cada tabla tiene su función `ensure*()` en `lib/db.ts` que ejecuta `CREATE TABLE IF NOT EXISTS`. La función `initDB()` las llama en orden la primera vez que se recibe un request. Esto garantiza que la DB esté siempre actualizada al iniciar el servidor, sin pasos manuales.

---

## Sistema de diseño

Todos los estilos están en `app/globals.css`. Variables CSS principales:

```css
--brand:      #0f766e  /* Verde teal — color principal */
--bg:         #f4f6f3  /* Fondo general */
--panel:      #ffffff  /* Paneles y tarjetas */
--text:       #17201a  /* Texto principal */
--muted:      #66706a  /* Texto secundario */
--danger:     #b42318  /* Rojo — acciones destructivas */
--ok:         #15803d  /* Verde — estados positivos */
```

El sidebar usa fondo oscuro `#101a17` para contraste con el contenido principal.

---

## Ejecución local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.local.example .env.local
# Editar DATABASE_URL y AUTH_SECRET

# 3. Crear la base de datos en PostgreSQL
psql -U postgres -c "CREATE DATABASE taller_mecanico;"

# 4. Iniciar en desarrollo
npm run dev
# → http://localhost:3000
```

Las tablas se crean automáticamente en el primer request.

---

## Deploy con Docker

```bash
# Build y levantar
docker compose up -d --build

# Ver logs
docker compose logs -f app
```

El CI/CD en GitHub Actions hace deploy automático al hacer push a `main`: conecta por SSH al VPS y ejecuta `git pull && docker compose up -d --build`.

---

## Convenciones de desarrollo

- **Nunca usar `middleware.ts`** — usar `proxy.ts` con `export function proxy()` (Next.js 16)
- **Sin ORM** — queries SQL directas con el driver `pg`
- **Sin Tailwind** — CSS custom en `globals.css`
- **Sin `any`** — TypeScript estricto en todo el stack
- **Sin inline styles** salvo casos puntuales de layout variable
- **Toda query filtra por `taller_id`** — regla innegociable
- Los Server Components obtienen la sesión con `getSession()` y redirigen si es null
- Los Client Components hacen fetch a las rutas `/api/*` — nunca acceden a la DB directamente
