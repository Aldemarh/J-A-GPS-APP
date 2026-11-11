import { z } from 'zod';

const name = z
  .string({ error: (iss) => (iss.input === undefined ? 'El nombre es obligatorio.' : 'El nombre no es válido.') })
  .trim()
  .min(1, 'El nombre es obligatorio.')
  .max(100, 'Máximo 100 caracteres.');

const vehicleId = z.uuid({
  error: (iss) => (iss.input === undefined ? 'El vehículo es obligatorio.' : 'Vehículo no encontrado.'),
});

export const createDeviceSchema = z.object({ name, vehicleId });

export const updateDeviceSchema = z
  .object({ name: name.optional(), vehicleId: vehicleId.optional() })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Envía al menos un campo para actualizar.',
  });
