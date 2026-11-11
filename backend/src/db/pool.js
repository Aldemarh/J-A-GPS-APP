import pg from 'pg';
import { config } from '../config/index.js';

// Pool único compartido por toda la aplicación.
const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: config.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: config.DB_SSL ? { rejectUnauthorized: config.isProduction } : false,
});

// Un error en una conexión inactiva no debe tumbar el proceso.
pool.on('error', (err) => {
  console.error('[db] Error inesperado en cliente inactivo:', err.message);
});

/**
 * Ejecuta una consulta parametrizada (siempre usar $1, $2… para evitar SQL injection).
 */
export function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Ejecuta varias operaciones en una misma transacción.
 * Si la función lanza un error, se hace ROLLBACK automáticamente.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}

export { pool };
