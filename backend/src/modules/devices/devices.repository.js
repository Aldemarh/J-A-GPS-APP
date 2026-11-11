import { query } from '../../db/pool.js';

// REGLA: toda consulta filtra por tenant_id. Nunca buscar un dispositivo solo por id.

const COLUMNS =
  'id, tenant_id, vehicle_id, name, protocol, identifier, last_seen_at, created_at, updated_at';

const EDITABLE = { name: 'name', vehicleId: 'vehicle_id' };

export async function listByTenant(tenantId) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM devices WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId],
  );
  return rows;
}

export async function findById(tenantId, id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM devices WHERE tenant_id = $1 AND id = $2`, [
    tenantId,
    id,
  ]);
  return rows[0] ?? null;
}

export async function create(tenantId, { name, vehicleId, protocol, identifier }) {
  const { rows } = await query(
    `INSERT INTO devices (tenant_id, vehicle_id, name, protocol, identifier)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUMNS}`,
    [tenantId, vehicleId, name, protocol, identifier],
  );
  return rows[0];
}

export async function update(tenantId, id, data) {
  const sets = [];
  const values = [tenantId, id];
  for (const [field, column] of Object.entries(EDITABLE)) {
    if (data[field] !== undefined) {
      values.push(data[field]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (sets.length === 0) return findById(tenantId, id);

  const { rows } = await query(
    `UPDATE devices SET ${sets.join(', ')}, updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING ${COLUMNS}`,
    values,
  );
  return rows[0] ?? null;
}

export async function remove(tenantId, id) {
  const { rowCount } = await query('DELETE FROM devices WHERE tenant_id = $1 AND id = $2', [
    tenantId,
    id,
  ]);
  return rowCount > 0;
}
