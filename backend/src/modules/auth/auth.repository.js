import { query, withTransaction } from '../../db/pool.js';

// Solo consultas SQL. Sin lógica de negocio.

export async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT id, tenant_id, email, password_hash, full_name, role, is_active
       FROM users
      WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findUserById(id) {
  const { rows } = await query(
    `SELECT u.id, u.tenant_id, u.email, u.full_name, u.role, u.is_active,
            t.name AS tenant_name, t.type AS tenant_type
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Crea el tenant personal y el usuario dueño en una sola transacción.
 * Si algo falla, no queda un tenant huérfano.
 */
export function createPersonalAccount({ fullName, email, passwordHash }) {
  return withTransaction(async (client) => {
    const tenant = await client.query(
      `INSERT INTO tenants (name, type)
       VALUES ($1, 'personal')
       RETURNING id`,
      [fullName],
    );

    const user = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'owner')
       RETURNING id, tenant_id, email, full_name, role`,
      [tenant.rows[0].id, email, passwordHash, fullName],
    );

    return user.rows[0];
  });
}
