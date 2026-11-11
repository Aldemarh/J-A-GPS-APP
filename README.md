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

## Seguridad

- Nunca subir `.env` ni secretos al repositorio.
- `JWT_SECRET` debe tener al menos 32 caracteres aleatorios y ser distinto en cada entorno.
- En producción: `NODE_ENV=production`, `DB_SSL=true` y HTTPS delante de la API.
