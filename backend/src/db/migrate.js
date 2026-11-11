import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

/**
 * Aplica, en orden alfabético, cada archivo .sql que aún no esté registrado
 * en la tabla schema_migrations. Cada migración corre en su propia transacción.
 */
async function migrate() {
  // La tabla de control se crea primero (la migración 001 también la contiene con IF NOT EXISTS).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = new Set(
    (await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
  );

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[migrate] Aplicada: ${file}`);
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Falló la migración ${file}: ${err.message}`);
    } finally {
      client.release();
    }
  }

  console.log(count === 0 ? '[migrate] Base de datos al día.' : `[migrate] ${count} migración(es) aplicada(s).`);
}

migrate()
  .catch((err) => {
    console.error('[migrate] Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
