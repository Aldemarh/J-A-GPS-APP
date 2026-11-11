import * as repo from './positions.repository.js';

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
