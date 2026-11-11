# J&A GPS

Plataforma SaaS de monitoreo GPS para vehículos. Inicialmente para personas naturales; preparada para empresas (multi-tenant).

## Stack

- **Frontend:** React + Vite + Tailwind CSS *(pendiente)*
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Mapas:** Leaflet + OpenStreetMap *(pendiente)*
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

## Seguridad

- Nunca subir `.env` ni secretos al repositorio.
- `JWT_SECRET` debe tener al menos 32 caracteres aleatorios y ser distinto en cada entorno.
- En producción: `NODE_ENV=production`, `DB_SSL=true` y HTTPS delante de la API.
