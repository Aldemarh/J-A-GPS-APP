# Arquitectura de J&A GPS

## Visión general

```
┌──────────────┐   HTTPS + JWT   ┌──────────────────┐   SQL (pool)   ┌──────────────┐
│  Frontend    │ ──────────────▶ │  Backend (API)   │ ─────────────▶ │  PostgreSQL  │
│  React+Vite  │ ◀────────────── │  Node + Express  │                │              │
│  Tailwind    │   Socket.IO     │  Socket.IO       │                └──────────────┘
│  Leaflet/OSM │ ◀ ─ ─ ─ ─ ─ ─ ▶ │                  │
└──────────────┘                 └──────────────────┘
```

Frontend, backend y base de datos son procesos separados. Se comunican solo por HTTP/WebSocket y SQL. Ninguno lee archivos del otro.

## Estructura de carpetas

```
J&A-GPS-APP/
├── backend/          API Node.js + Express + PostgreSQL
│   └── src/
│       ├── config/       Validación de variables de entorno (zod)
│       ├── db/           Pool de conexiones, transacciones, migraciones SQL
│       ├── middleware/   auth (JWT), validación, manejo de errores
│       ├── modules/      Un módulo por dominio
│       │   ├── auth/     routes → controller → service → repository
│       │   └── vehicles/ CRUD de vehículos, siempre filtrado por tenant
│       ├── utils/        AppError, asyncHandler
│       ├── app.js        Configura Express (sin abrir puerto; testeable)
│       └── server.js     Arranque, verificación de BD, cierre ordenado
├── frontend/         React + Vite + Tailwind
│   └── src/
│       ├── api/          Cliente HTTP único (token, errores, sesión vencida)
│       ├── context/      AuthContext (estado de sesión)
│       ├── hooks/        useVehicles
│       ├── components/   Formularios, lista de vehículos, mapa (Leaflet)
│       └── pages/        Login, registro, panel, 404
└── docs/             Documentación técnica
```

## Decisiones

### Multi-tenant (aislamiento de datos)
- Cada cuenta es un **tenant**. Una persona natural tiene un tenant `personal`; una empresa será un tenant `company` con varios usuarios.
- Todas las tablas de negocio llevarán `tenant_id`.
- El `tenant_id` del usuario se toma **del token JWT firmado**, nunca de la petición del cliente. Los repositorios deben filtrar siempre por ese valor.
- Roles previstos: `owner`, `admin`, `member` (la columna ya existe en `users`).

### Autenticación
- Contraseñas con **bcrypt** (12 rondas). Nunca se guardan en texto plano.
- Login con mensaje genérico y tiempo de respuesta uniforme (no revela si un correo existe).
- **JWT HS256** con `issuer` y `subject`; expiración configurable (`JWT_EXPIRES_IN`).
- Limitador de intentos en `/api/auth` (20 peticiones / 15 min por IP).
- Pendiente para una etapa posterior: refresh tokens y revocación.

### Base de datos
- PostgreSQL con `gen_random_uuid()` (sin extensiones adicionales).
- Migraciones SQL versionadas en `backend/src/db/migrations/`, aplicadas en orden y dentro de transacciones: `npm run db:migrate`.
- Consultas parametrizadas siempre (`$1, $2…`), nunca concatenación de texto.

### Configuración
- Todo lo sensible va en variables de entorno (`backend/.env`, ignorado por git). Plantilla en `backend/.env.example`.
- Al arrancar se valida la configuración; si falta algo, el servidor no inicia y muestra qué corregir.

### Errores y respuestas
- Errores controlados con `AppError` (mensaje visible al cliente).
- Errores inesperados: 500 genérico; el detalle solo se muestra fuera de producción.

### Aislamiento en la práctica (vehículos)
- El repositorio nunca busca un vehículo solo por `id`: siempre `WHERE tenant_id = $1 AND id = $2`.
- Si una cuenta pide un recurso de otra, la respuesta es **404**, no 403, para no revelar que existe.
- Hay una prueba automática específica para esto (`backend/test/vehicles.test.js`).

### Mapa
- Leaflet + teselas de OpenStreetMap, con su atribución obligatoria.
- No se muestran ubicaciones inventadas: sin dispositivo GPS conectado, el mapa lo indica.
- Para producción con tráfico real hay que usar un proveedor de teselas propio o de pago: la política de uso de los servidores públicos de OSM no permite cargas altas.

### Base de datos (Neon)
- Desarrollo usa el branch `dev` de Neon, base `jya_gps`.
- El branch `production`, base `neondb`, tiene un esquema anterior distinto (accounts, memberships, PostGIS/TimescaleDB). Las migraciones de este repo **no** se aplican ahí. Unificar ambos diseños es una decisión pendiente.

## Etapas
1. ✅ Backend: configuración, PostgreSQL, autenticación JWT.
2. ✅ Frontend: login, registro y ruta protegida.
3. ✅ Vehículos (CRUD por cuenta) y mapa base.
4. Dispositivos GPS: alta del equipo, vínculo con el vehículo y recepción de posiciones.
5. Ubicaciones en tiempo real con Socket.IO sobre el mapa.
6. Refresh tokens, roles de empresa e invitaciones de usuarios.
