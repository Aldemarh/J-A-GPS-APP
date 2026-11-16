import { z } from 'zod';

// Rango máximo de un recorrido: más días serían muchas posiciones para una sola respuesta.
export const MAX_TRACK_DAYS = 7;

// Fecha y hora ISO 8601 con zona horaria, p. ej. "2026-11-16T00:00:00-05:00" o "...Z".
const instant = (label) =>
  z
    .string({ error: (iss) => (iss.input === undefined ? `${label} es obligatoria.` : `${label} no es válida.`) })
    .pipe(z.iso.datetime({ offset: true, error: `${label} no es una fecha y hora válida (ISO 8601).` }))
    .transform((v) => new Date(v));

// Las reglas del rango solo se revisan si las dos fechas son válidas (si no, sobran errores).
const bothDates = ({ value }) => value.from instanceof Date && value.to instanceof Date;

export const trackQuerySchema = z
  .object({
    from: instant('La fecha inicial'),
    to: instant('La fecha final'),
  })
  .refine((q) => q.to > q.from, {
    path: ['to'],
    error: 'La fecha final debe ser posterior a la inicial.',
    when: bothDates,
  })
  .refine((q) => q.to - q.from <= MAX_TRACK_DAYS * 24 * 60 * 60 * 1000, {
    path: ['to'],
    error: `El rango no puede superar ${MAX_TRACK_DAYS} días.`,
    when: bothDates,
  });
