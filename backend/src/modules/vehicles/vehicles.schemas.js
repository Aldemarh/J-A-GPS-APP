import { z } from 'zod';

export const VEHICLE_TYPES = ['car', 'motorcycle', 'truck', 'other'];

// Texto opcional: '' o null se guardan como null.
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

// Placa: se normaliza a mayúsculas y sin espacios ni guiones ("abc-123" → "ABC123").
const plate = z
  .string({ error: (iss) => (iss.input === undefined ? 'La placa es obligatoria.' : 'La placa no es válida.') })
  .transform((v) => v.toUpperCase().replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^[A-Z0-9]{3,10}$/, 'La placa debe tener entre 3 y 10 letras o números.'));

const name = z
  .string({ error: (iss) => (iss.input === undefined ? 'El nombre es obligatorio.' : 'El nombre no es válido.') })
  .trim()
  .min(1, 'El nombre es obligatorio.')
  .max(100, 'Máximo 100 caracteres.');

const type = z.enum(VEHICLE_TYPES, { error: 'Tipo de vehículo no válido.' });

const year = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
  .pipe(
    z
      .number({ error: 'El año no es válido.' })
      .int('El año no es válido.')
      .min(1950, 'El año debe ser 1950 o posterior.')
      .max(2100, 'El año no es válido.')
      .nullable(),
  );

export const createVehicleSchema = z.object({
  name,
  plate,
  type: type.default('car'),
  brand: optionalText(60),
  model: optionalText(60),
  color: optionalText(30),
  year,
});

// En la edición todos los campos son opcionales, pero debe venir al menos uno.
export const updateVehicleSchema = z
  .object({
    name: name.optional(),
    plate: plate.optional(),
    type: type.optional(),
    brand: optionalText(60).optional(),
    model: optionalText(60).optional(),
    color: optionalText(30).optional(),
    year: year.optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Envía al menos un campo para actualizar.',
  });
