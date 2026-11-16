import { query } from '../../db/pool.js';

// Recibe el cliente de la transacción de ingesta.
export async function insertPosition(client, p) {
  await client.query(
    `INSERT INTO positions
       (tenant_id, vehicle_id, device_id, recorded_at, latitude, longitude,
        speed_kmh, course, altitude, accuracy, battery)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      p.tenantId,
      p.vehicleId,
      p.deviceId,
      p.recordedAt,
      p.latitude,
      p.longitude,
      p.speedKmh ?? null,
      p.course ?? null,
      p.altitude ?? null,
      p.accuracy ?? null,
      p.battery ?? null,
    ],
  );
}

// Posiciones de un vehículo en [from, to), de la más antigua a la más reciente (usa el índice
// vehicle_id + recorded_at). `limit` protege la memoria si un equipo envió muchísimos datos.
export async function trackByVehicle(tenantId, vehicleId, from, to, limit) {
  const { rows } = await query(
    `SELECT recorded_at, latitude, longitude, speed_kmh, course
       FROM positions
      WHERE tenant_id = $1 AND vehicle_id = $2 AND recorded_at >= $3 AND recorded_at < $4
      ORDER BY recorded_at ASC
      LIMIT $5`,
    [tenantId, vehicleId, from, to, limit],
  );
  return rows;
}

// Última posición de cada vehículo de la cuenta (usa el índice vehicle_id + recorded_at).
export async function latestByTenant(tenantId) {
  const { rows } = await query(
    `SELECT v.id AS vehicle_id, p.device_id, p.recorded_at, p.latitude, p.longitude,
            p.speed_kmh, p.course, p.accuracy, p.battery
       FROM vehicles v
       CROSS JOIN LATERAL (
         SELECT device_id, recorded_at, latitude, longitude, speed_kmh, course, accuracy, battery
           FROM positions
          WHERE positions.vehicle_id = v.id
          ORDER BY recorded_at DESC
          LIMIT 1
       ) p
      WHERE v.tenant_id = $1`,
    [tenantId],
  );
  return rows;
}
