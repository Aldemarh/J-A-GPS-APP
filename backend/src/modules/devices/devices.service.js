import { randomInt } from 'node:crypto';
import { AppError } from '../../utils/AppError.js';
import * as repo from './devices.repository.js';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

// Sin caracteres que se confunden al escribir (0/o, 1/l/i). 16 caracteres ≈ 79 bits de azar.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

// El protocolo del celular solo envía este identificador: funciona como contraseña del dispositivo.
export function generateIdentifier() {
  const chars = Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return chars.match(/.{4}/g).join('-');
}

function toPublic(d) {
  return {
    id: d.id,
    vehicleId: d.vehicle_id,
    name: d.name,
    protocol: d.protocol,
    identifier: d.identifier,
    lastSeenAt: d.last_seen_at,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

// La FK compuesta (tenant_id, vehicle_id) rechaza vehículos inexistentes o de otra cuenta.
async function guardVehicleLink(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.code === FOREIGN_KEY_VIOLATION && err.constraint === 'devices_vehicle_same_tenant_fk') {
      throw new AppError(400, 'Datos inválidos.', [{ field: 'vehicleId', message: 'Vehículo no encontrado.' }]);
    }
    if (err.code === UNIQUE_VIOLATION && err.constraint === 'devices_vehicle_unique') {
      throw new AppError(409, 'Ese vehículo ya tiene un dispositivo GPS vinculado.');
    }
    throw err;
  }
}

const notFound = () => new AppError(404, 'Dispositivo no encontrado.');

export async function list(tenantId) {
  return (await repo.listByTenant(tenantId)).map(toPublic);
}

export async function get(tenantId, id) {
  const device = await repo.findById(tenantId, id);
  if (!device) throw notFound();
  return toPublic(device);
}

export async function create(tenantId, { name, vehicleId }) {
  const device = await guardVehicleLink(() =>
    repo.create(tenantId, { name, vehicleId, protocol: 'osmand', identifier: generateIdentifier() }),
  );
  return toPublic(device);
}

export async function update(tenantId, id, data) {
  const device = await guardVehicleLink(() => repo.update(tenantId, id, data));
  if (!device) throw notFound();
  return toPublic(device);
}

export async function remove(tenantId, id) {
  const deleted = await repo.remove(tenantId, id);
  if (!deleted) throw notFound();
}
