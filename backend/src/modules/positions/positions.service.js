import { AppError } from '../../utils/AppError.js';
import * as vehiclesRepo from '../vehicles/vehicles.repository.js';
import * as repo from './positions.repository.js';
import { cleanTrack, summarizeTrack, thinTrack } from './track.js';

// Tope de posiciones leídas por recorrido: 7 días con una posición cada 10 s son ~60.500.
const MAX_TRACK_ROWS = 100_000;

function toPublic(p) {
  return {
    vehicleId: p.vehicle_id,
    deviceId: p.device_id,
    recordedAt: p.recorded_at,
    latitude: p.latitude,
    longitude: p.longitude,
    speedKmh: p.speed_kmh,
    course: p.course,
    accuracy: p.accuracy,
    battery: p.battery,
  };
}

export async function latest(tenantId) {
  return (await repo.latestByTenant(tenantId)).map(toPublic);
}

/**
 * Recorrido de un vehículo entre `from` y `to` (Date): trayecto para dibujar, resumen y paradas.
 * Un vehículo de otra cuenta responde 404, igual que uno inexistente.
 */
export async function track(tenantId, vehicleId, { from, to }) {
  const vehicle = await vehiclesRepo.findById(tenantId, vehicleId);
  if (!vehicle) throw new AppError(404, 'Vehículo no encontrado.');

  const rows = await repo.trackByVehicle(tenantId, vehicleId, from, to, MAX_TRACK_ROWS);
  const points = cleanTrack(
    rows.map((r) => ({
      recordedAt: r.recorded_at,
      latitude: r.latitude,
      longitude: r.longitude,
      speedKmh: r.speed_kmh,
      course: r.course,
    })),
  );
  const { summary, stops } = summarizeTrack(points);
  const drawn = thinTrack(points);

  return {
    vehicleId,
    from,
    to,
    summary,
    stops,
    points: drawn,
    // Se dibujan menos puntos de los recibidos (el resumen sí usa todos).
    simplified: drawn.length < points.length,
    // Se alcanzó el tope de lectura: el recorrido termina antes de `to`.
    truncated: rows.length === MAX_TRACK_ROWS,
  };
}
