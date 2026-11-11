import { config } from './config/index.js';
import { createApp } from './app.js';
import { pool, closePool } from './db/pool.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`[server] API escuchando en http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

// Verifica la conexión a PostgreSQL al arrancar (falla rápido si no hay BD).
pool
  .query('SELECT 1')
  .then(() => console.log('[db] Conexión a PostgreSQL OK'))
  .catch((err) => {
    console.error('[db] No se pudo conectar a PostgreSQL:', err.message);
  });

// Cierre ordenado: termina peticiones en curso y libera el pool.
async function shutdown(signal) {
  console.log(`[server] ${signal} recibido, cerrando...`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
