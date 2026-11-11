import { query } from '../../db/pool.js';

// REGLA: toda consulta filtra por tenant_id. Nunca buscar un vehículo solo por id.

const COLUMNS = 'id, tenant_id, name, plate, type, brand, model, color, year, created_at, updated_at';

// Campos editables: nombre en la API → columna en la BD (lista blanca contra SQL injection).
const EDITABLE = {
  name: 'name',
  plate: 'plate',
  type: 'type',
  brand: 'brand',
  model: 'model',
  color: 'color',
  year: 'year',
};

export async function listByTenant(tenantId) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM vehicles WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId],
  );
  return rows;
}

export async function findById(tenantId, id) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM vehicles WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );
  return rows[0] ?? null;
}

export async function create(tenantId, data) {
  const { rows } = await query(
    `INSERT INTO vehicles (tenant_id, name, plate, type, brand, model, color, year)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${COLUMNS}`,
    [tenantId, data.name, data.plate, data.type, data.brand, data.model, data.color, data.year],
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
    `UPDATE vehicles SET ${sets.join(', ')}, updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING ${COLUMNS}`,
    values,
  );
  return rows[0] ?? null;
}

export async function remove(tenantId, id) {
  const { rowCount } = await query('DELETE FROM vehicles WHERE tenant_id = $1 AND id = $2', [
    tenantId,
    id,
  ]);
  return rowCount > 0;
}
