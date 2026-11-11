# J&A GPS

Plataforma SaaS de monitoreo GPS para vehículos. Inicialmente para personas naturales; preparada para empresas (multi-tenant).

## Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL (Neon)
- **Mapas:** Leaflet + OpenStreetMap
- **Tiempo real:** Socket.IO *(pendiente)*
- **Autenticación:** JWT + bcrypt

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para decisiones de diseño.

## Requisitos

- Node.js 20 o superior
- PostgreSQL 14 o superior

## Puesta en marcha (backend)

```bash
cd backend
npm install
cp .env.example .env        # y completar DATABASE_URL, JWT_SECRET, etc.
npm run db:migrate          # crea las tablas
npm run dev                 # API en http://localhost:4000
```

Verificar que funciona:

```bash
curl http://localhost:4000/api/health
```

## Endpoints de autenticación

| Método | Ruta                 | Descripción                         | Auth |
|--------|----------------------|-------------------------------------|------|
| POST   | `/api/auth/register` | Crea cuenta personal y devuelve JWT | No   |
| POST   | `/api/auth/login`    | Inicia sesión y devuelve JWT        | No   |
| GET    | `/api/auth/me`       | Datos del usuario autenticado       | Sí   |

Enviar el token como `Authorization: Bearer <token>`.

## Endpoints de vehículos

Todos requieren token. Cada cuenta solo ve y modifica sus propios vehículos. Crear, editar y eliminar requiere rol `owner` o `admin`.

| Método | Ruta                 | Descripción                                   |
|--------|----------------------|-----------------------------------------------|
| GET    | `/api/vehicles`      | Lista los vehículos de la cuenta              |
| GET    | `/api/vehicles/:id`  | Detalle de un vehículo                        |
| POST   | `/api/vehicles`      | Crea un vehículo (`name`, `plate` obligatorios) |
| PATCH  | `/api/vehicles/:id`  | Edita solo los campos enviados                |
| DELETE | `/api/vehicles/:id`  | Elimina el vehículo                           |

La placa se guarda en mayúsculas, sin espacios ni guiones, y es única dentro de cada cuenta.

## Endpoints de dispositivos GPS

Mismas reglas que vehículos: token obligatorio, aislamiento por cuenta y rol `owner`/`admin` para modificar.

| Método | Ruta                 | Descripción                                                        |
|--------|----------------------|--------------------------------------------------------------------|
| GET    | `/api/devices`       | Lista los dispositivos de la cuenta                                |
| GET    | `/api/devices/:id`   | Detalle de un dispositivo                                          |
| POST   | `/api/devices`       | Crea un dispositivo (`name`, `vehicleId`); el servidor genera el identificador |
| PATCH  | `/api/devices/:id`   | Cambia `name` o lo mueve a otro vehículo propio (`vehicleId`)      |
| DELETE | `/api/devices/:id`   | Elimina el dispositivo                                             |

Un vehículo tiene como máximo un dispositivo. Al borrar el vehículo se borra su dispositivo.

## Posiciones

| Método     | Ruta                     | Descripción                                                     | Auth                       |
|------------|--------------------------|-----------------------------------------------------------------|----------------------------|
| GET / POST | `/api/ingest/osmand`     | Recibe posiciones del dispositivo (protocolo OsmAnd, Traccar Client) | Identificador del dispositivo |
| GET        | `/api/positions/latest`  | Última posición de cada vehículo de la cuenta                   | JWT                        |

El historial pertenece al vehículo: si se borra el dispositivo, las posiciones se conservan.

### Simular un dispositivo (sin celular)

1. En el panel, abre "Conectar" en un vehículo y copia el identificador.
2. Con la API corriendo:

```bash
cd backend
npm run simulate -- <identificador>                # una posición cada 5 s desde Bogotá
npm run simulate -- <identificador> --interval 2 --lat 6.2442 --lon -75.5812
```

El mapa se actualiza cada 10 segundos. `Ctrl+C` detiene la simulación.

## Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 (redirige /api al backend en :4000)
```

## Pruebas

```bash
cd backend
npm test                    # requiere la base de datos con migraciones aplicadas
```

Las pruebas crean cuentas `@ejemplo.com` y las borran al terminar. Nunca ejecutarlas contra la base de producción.

## Seguridad

- Nunca subir `.env` ni secretos al repositorio.
- `JWT_SECRET` debe tener al menos 32 caracteres aleatorios y ser distinto en cada entorno.
- En producción: `NODE_ENV=production`, `DB_SSL=true` y HTTPS delante de la API.
