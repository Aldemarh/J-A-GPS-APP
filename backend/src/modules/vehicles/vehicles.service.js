import { AppError } from '../../utils/AppError.js';
import * as repo from './vehicles.repository.js';

const UNIQUE_VIOLATION = '23505';

function toPublic(v) {
  return {
    id: v.id,
    name: v.name,
    plate: v.plate,
    type: v.type,
    brand: v.brand,
    model: v.model,
    color: v.color,
    year: v.year,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  };
}

// Convierte el choque de placa repetida en un 409 entendible.
async function guardDuplicatePlate(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      throw new AppError(409, 'Ya tienes un vehículo registrado con esa placa.');
    }
    throw err;
  }
}

const notFound = () => new AppError(404, 'Vehículo no encontrado.');

export async function list(tenantId) {
  return (await repo.listByTenant(tenantId)).map(toPublic);
}

export async function get(tenantId, id) {
  const vehicle = await repo.findById(tenantId, id);
  if (!vehicle) throw notFound();
  return toPublic(vehicle);
}

export async function create(tenantId, data) {
  const vehicle = await guardDuplicatePlate(() => repo.create(tenantId, data));
  return toPublic(vehicle);
}

export async function update(tenantId, id, data) {
  const vehicle = await guardDuplicatePlate(() => repo.update(tenantId, id, data));
  if (!vehicle) throw notFound();
  return toPublic(vehicle);
}

export async function remove(tenantId, id) {
  const deleted = await repo.remove(tenantId, id);
  if (!deleted) throw notFound();
}
