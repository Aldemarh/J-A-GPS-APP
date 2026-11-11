import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/index.js';
import { query } from './db/pool.js';
import authRoutes from './modules/auth/auth.routes.js';
import vehicleRoutes from './modules/vehicles/vehicles.routes.js';
import deviceRoutes from './modules/devices/devices.routes.js';
import positionRoutes from './modules/positions/positions.routes.js';
import ingestRoutes from './modules/ingest/ingest.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

/**
 * Crea la aplicación Express (sin arrancar el servidor).
 * Separar app.js de server.js permite probarla sin abrir un puerto.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.isProduction ? 1 : false);

  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (req, res) => {
    let database = 'ok';
    try {
      await query('SELECT 1');
    } catch {
      database = 'unavailable';
    }
    res.status(database === 'ok' ? 200 : 503).json({
      status: database === 'ok' ? 'ok' : 'degraded',
      service: 'jya-gps-api',
      database,
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/vehicles', vehicleRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/positions', positionRoutes);
  app.use('/api/ingest', ingestRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
