import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { insertPosition } from '../positions/positions.repository.js';

/**
 * Guarda una posición enviada por un dispositivo.
 * El identificador es la única credencial del equipo: de él salen la cuenta y el vehículo.
 */
export async function recordFromDevice({ identifier, ...position }) {
  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE devices SET last_seen_at = NOW()
        WHERE identifier = $1
        RETURNING id, tenant_id, vehicle_id`,
      [identifier],
    );
    const device = rows[0];
    if (!device) throw new AppError(404, 'Dispositivo no registrado.');

    await insertPosition(client, {
      tenantId: device.tenant_id,
      vehicleId: device.vehicle_id,
      deviceId: device.id,
      ...position,
    });
  });
}
