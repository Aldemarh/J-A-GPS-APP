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
│   ├── src/
│   │   ├── config/       Validación de variables de entorno (zod)
│   │   ├── db/           Pool de conexiones, transacciones, migraciones SQL
│   │   ├── middleware/   auth (JWT), validación, manejo de errores
│   │   ├── modules/      Un módulo por dominio
│   │   │   ├── auth/      routes → controller → service → repository
│   │   │   ├── vehicles/  CRUD de vehículos, siempre filtrado por tenant
│   │   │   ├── devices/   Dispositivos GPS vinculados a vehículos
│   │   │   ├── ingest/    Recepción de posiciones desde los equipos (sin JWT)
│   │   │   └── positions/ Consulta de posiciones (última ubicación por vehículo)
│   │   ├── utils/        AppError, asyncHandler
│   │   ├── app.js        Configura Express (sin abrir puerto; testeable)
│   │   └── server.js     Arranque, verificación de BD, cierre ordenado
│   ├── scripts/      simulate-device.js: simula un celular con Traccar Client
│   └── test/         Pruebas de integración (node --test)
├── frontend/         React + Vite + Tailwind
│   └── src/
│       ├── api/          Cliente HTTP único (token, errores, sesión vencida)
│       ├── context/      AuthContext (estado de sesión)
│       ├── hooks/        useVehicles, useDevices, useLatestPositions
│       ├── components/   Formularios, modales, vehículos, dispositivos, mapa (Leaflet)
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

### Dispositivos GPS
- Un vehículo tiene como máximo un dispositivo y cada dispositivo pertenece a un vehículo (modelo simple para persona natural; para empresas se podrá permitir inventario sin vehículo quitando el `NOT NULL`).
- La clave foránea compuesta `(tenant_id, vehicle_id) → vehicles (tenant_id, id)` hace que la **base de datos** rechace vincular un vehículo de otra cuenta, además del filtro en el código.
- Protocolo inicial `osmand`: el celular con la app gratuita *Traccar Client* actúa como rastreador. Los rastreadores físicos (GT06/Concox, TK103/Coban, Teltonika) se agregarán como nuevos valores de `protocol`, con su propio receptor.
- Ese protocolo solo envía un identificador, por eso lo genera el servidor (16 caracteres al azar, ≈79 bits) y el cliente no puede elegirlo: funciona como la contraseña del dispositivo.

### Recepción y almacenamiento de posiciones
- `/api/ingest/osmand` no usa el JWT de usuario: el identificador del dispositivo determina la cuenta y el vehículo. Tiene su propio límite (120 posiciones/min por IP).
- Acepta las dos variantes de Traccar Client: la clásica (parámetros en la URL, velocidad en nudos, hora Unix) y la JSON de versiones recientes (velocidad en m/s, batería 0–1). Todo se guarda normalizado: km/h y batería en %.
- Se rechazan posiciones sin identificador, con coordenadas inválidas o con hora más de 10 min en el futuro. Un dato opcional fuera de rango (rumbo, batería…) se descarta sin perder la posición.
- `recorded_at` es la hora del GPS y `received_at` la de llegada: el celular puede enviar tarde posiciones guardadas sin señal, y una posición atrasada no reemplaza a la última.
- La tabla `positions` usa id `BIGINT` (es la que más crece) y una FK compuesta `(tenant_id, vehicle_id)` como en dispositivos. El historial es del vehículo: borrar el dispositivo deja `device_id` en NULL.
- Hasta tener Socket.IO (etapa 6), el panel consulta `/api/positions/latest` cada 10 s con la pestaña visible.

### Mapa
- Leaflet + teselas de OpenStreetMap, con su atribución obligatoria.
- Marcadores con `CircleMarker` (los íconos por defecto de Leaflet necesitan configuración extra con Vite). El mapa se encuadra en los vehículos solo la primera vez.
- No se muestran ubicaciones inventadas: sin dispositivo GPS conectado, el mapa lo indica.
- Para producción con tráfico real hay que usar un proveedor de teselas propio o de pago: la política de uso de los servidores públicos de OSM no permite cargas altas.

### Base de datos (Neon)
- Desarrollo usa el branch `dev` de Neon, base `jya_gps`.
- El branch `production`, base `neondb`, tiene un esquema anterior distinto (accounts, memberships, PostGIS/TimescaleDB). Las migraciones de este repo **no** se aplican ahí. Unificar ambos diseños es una decisión pendiente.

## Etapas (plan persona natural)
1. ✅ Backend: configuración, PostgreSQL, autenticación JWT.
2. ✅ Frontend: login, registro y ruta protegida.
3. ✅ Vehículos (CRUD por cuenta) y mapa base.
4. ✅ Dispositivos GPS: registro y vínculo con el vehículo.
5. ✅ Recepción de posiciones (protocolo de Traccar Client) y última ubicación en el mapa. Probado con el simulador; falta probar con un celular real.
6. Tiempo real con Socket.IO: el marcador se mueve solo; estado en línea / sin señal.
7. Historial de recorridos: trayecto por fechas, distancia y paradas.
8. Mi cuenta: perfil, cambio de contraseña y recuperación por correo.
9. Alertas básicas: exceso de velocidad, sin señal y geocercas.
10. Despliegue: servidor público con HTTPS, dominio y renovación de sesión (refresh tokens).

Después: plan de empresa (usuarios, roles, invitaciones, suscripciones).
