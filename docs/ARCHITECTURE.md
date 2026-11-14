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
│       ├── context/      AuthContext (sesión), FleetContext (datos de la flota compartidos)
│       ├── hooks/        useVehicles, useDevices, useLatestPositions
│       ├── components/   Menú (layout), lista/detalle/estados (fleet), vehículos, dispositivos, mapa
│       └── pages/        Login, registro, mapa en vivo, vehículos, 404
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
- Hasta tener Socket.IO (etapa 7), el mapa consulta `/api/positions/latest` cada 5 s con la pestaña visible.

### Diseño
- La plataforma sigue el panel de demostración de la landing (`Project-GPS/index.html`, sección «Experiencia del software»): tema grafito, fuentes Geist y Geist Mono, marca **J&A Tech**, acento azul, verde = en movimiento, ámbar = detenido, gris = sin señal.
- Los colores y fuentes están como tokens en `frontend/src/index.css` (`@theme`), copiados de la landing; los botones, campos y avisos repetidos son clases (`.btn`, `.input`, `.alert-error`…). Si la landing cambia de paleta, se cambia ahí.
- El menú solo muestra secciones que existen. Recorridos, Alertas, Zonas, Reportes y Usuarios (que sí aparecen en la landing) se agregan cuando se construyan.
- No se muestran datos que el GPS no envía: el detalle omite «Motor», «Ubicación» (dirección) y «Recorrido de hoy» de la landing hasta tener ignición, geocodificación e historial. La actividad reciente llegará con las alertas.

### Mapa
- Leaflet + teselas de OpenStreetMap oscurecidas con un filtro CSS (`.map-tiles-dark`). Los mapas oscuros ya hechos (CARTO, Stadia) exigen clave de API: CARTO sin clave devuelve teselas con la marca «API KEY REQUIRED».
- Marcadores `L.divIcon` manejados directamente con Leaflet (`VehicleMarker`): halo + punto + placa, flecha de rumbo si se mueve, y halo pulsante en los que están en movimiento. Al llegar una posición nueva el marcador **se desliza** 4,5 s hasta ella en vez de saltar (no se anima si el salto supera 3 km ni con «reducir movimiento»).
- Interacción: clic en un marcador o en la lista selecciona el vehículo; desde la lista el mapa vuela hasta él; si el seleccionado se acerca al borde mientras avanza, el mapa lo acompaña; clic en el mapa vacío quita la selección. Controles propios de zoom y «ver todos», y escala en metros.
- El mapa se encuadra en los vehículos solo la primera vez; después el usuario decide dónde mirar.
- No se muestran ubicaciones inventadas: sin dispositivo GPS conectado, el mapa lo indica.
- Para producción con tráfico real hay que usar un proveedor de teselas propio o de pago: la política de uso de los servidores públicos de OSM no permite cargas altas. Con un proveedor oscuro basta cambiar `TILES_URL` en `FleetMap.jsx` y quitar el filtro.

### Mapa en vivo y estado de los vehículos
- Las pantallas privadas comparten un menú (`AppLayout`): lateral en escritorio, pestañas en celular. **Mapa en vivo** (`/`) es para monitorear y **Vehículos** (`/vehiculos`) para administrar.
- Mapa en vivo, como en la landing: lista de vehículos (con buscador por nombre o placa), mapa con contadores que también filtran, y detalle del seleccionado a la derecha. Entre 1024 y 1280 px el detalle va sobre la lista; en celular, mapa arriba y lista debajo.
- Vehículos, dispositivos y últimas posiciones se cargan una sola vez en `FleetContext`, dentro de la ruta protegida: cambiar de sección no repite peticiones y al cerrar sesión se descarta todo.
- El estado se calcula en el frontend (`components/fleet/fleetStatus.js`) con la hora del GPS (`recorded_at`):
  - **Sin GPS:** el vehículo no tiene dispositivo.
  - **Sin señal:** tiene dispositivo pero no ha enviado datos o el último tiene más de 10 min.
  - **En movimiento:** dato reciente con velocidad ≥ 5 km/h (por debajo se considera ruido del GPS).
  - **Detenido:** dato reciente con velocidad menor.
- Los estados se recalculan cada 15 s aunque no lleguen datos, para que un GPS que deja de reportar pase a "sin señal".
- El color del estado siempre va acompañado de su nombre (lista, detalle, contadores del mapa y título del marcador). El vehículo seleccionado se pinta de azul en el mapa.

### Base de datos (Neon)
- Desarrollo usa el branch `dev` de Neon, base `jya_gps`.
- El branch `production`, base `neondb`, tiene un esquema anterior distinto (accounts, memberships, PostGIS/TimescaleDB). Las migraciones de este repo **no** se aplican ahí. Unificar ambos diseños es una decisión pendiente.

## Etapas (plan persona natural)
1. ✅ Backend: configuración, PostgreSQL, autenticación JWT.
2. ✅ Frontend: login, registro y ruta protegida.
3. ✅ Vehículos (CRUD por cuenta) y mapa base.
4. ✅ Dispositivos GPS: registro y vínculo con el vehículo.
5. ✅ Recepción de posiciones (protocolo de Traccar Client) y última ubicación en el mapa. Probado con el simulador; la prueba con un celular real queda para cuando la API esté publicada con HTTPS (en red local exige IP, mismo Wi‑Fi y permiso de red local en iOS).
6. ✅ Mapa en vivo con el diseño de la landing: menú, contadores de la flota, estado y detalle de cada vehículo, marcadores que se deslizan.
7. Tiempo real con Socket.IO: las posiciones llegan al instante, sin consultar cada 5 s.
8. Historial de recorridos: trayecto por fechas, distancia y paradas.
9. Mi cuenta: perfil, cambio de contraseña y recuperación por correo.
10. Alertas básicas: exceso de velocidad, sin señal y geocercas.
11. Despliegue: servidor público con HTTPS, dominio y renovación de sesión (refresh tokens).

Después: plan de empresa (usuarios, roles, invitaciones, suscripciones).
