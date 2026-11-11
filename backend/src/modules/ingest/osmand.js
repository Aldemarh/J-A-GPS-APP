import { z } from 'zod';
import { AppError } from '../../utils/AppError.js';

// Protocolo OsmAnd, el que usa la app Traccar Client. Dos variantes:
//  - Clásica: parámetros en la URL (?id=&lat=&lon=&timestamp=&speed=&bearing=&altitude=&accuracy=&batt=),
//    velocidad en nudos y hora en segundos Unix.
//  - JSON (versiones recientes): { device_id, location: { timestamp, coords: {...}, battery: { level } } },
//    velocidad en m/s y batería de 0 a 1.

const KNOTS_TO_KMH = 1.852;
const MPS_TO_KMH = 3.6;
const MAX_FUTURE_MS = 10 * 60 * 1000;

const num = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// Acepta segundos o milisegundos Unix, o una fecha ISO. Sin hora, se usa la de recepción.
function parseTime(value) {
  if (value === undefined || value === null || value === '') return new Date();
  const text = String(value);
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    return new Date(Math.trunc(n).toString().length > 10 ? n : n * 1000);
  }
  return new Date(text);
}

function fromQuery(q) {
  const speed = num(q.speed);
  return {
    identifier: q.id ?? q.deviceid,
    recordedAt: parseTime(q.timestamp),
    latitude: num(q.lat),
    longitude: num(q.lon),
    speedKmh: speed === undefined ? undefined : speed * KNOTS_TO_KMH,
    course: num(q.bearing ?? q.heading),
    altitude: num(q.altitude),
    accuracy: num(q.accuracy),
    battery: num(q.batt),
  };
}

// En este formato, -1 significa "desconocido".
const known = (v) => (v !== undefined && v >= 0 ? v : undefined);

function fromJson(body) {
  const loc = body.location ?? {};
  const coords = loc.coords ?? {};
  const speed = known(num(coords.speed));
  const level = known(num(loc.battery?.level));
  return {
    identifier: body.device_id,
    recordedAt: parseTime(loc.timestamp),
    latitude: num(coords.latitude),
    longitude: num(coords.longitude),
    speedKmh: speed === undefined ? undefined : speed * MPS_TO_KMH,
    course: known(num(coords.heading)),
    altitude: num(coords.altitude),
    accuracy: num(coords.accuracy),
    battery: level === undefined ? undefined : level * 100,
  };
}

// Un dato opcional fuera de rango se descarta en vez de rechazar toda la posición.
const optional = (min, max) => z.number().min(min).max(max).nullish().catch(null);

const positionSchema = z.object({
  identifier: z
    .string({ error: 'Falta el identificador del dispositivo.' })
    .trim()
    .min(1, 'Falta el identificador del dispositivo.')
    .max(64, 'Identificador no válido.'),
  latitude: z.number({ error: 'Latitud no válida.' }).min(-90, 'Latitud no válida.').max(90, 'Latitud no válida.'),
  longitude: z
    .number({ error: 'Longitud no válida.' })
    .min(-180, 'Longitud no válida.')
    .max(180, 'Longitud no válida.'),
  recordedAt: z
    .date({ error: 'Hora de la posición no válida.' })
    .refine((d) => d.getTime() <= Date.now() + MAX_FUTURE_MS, 'La hora de la posición está en el futuro.'),
  speedKmh: optional(0, 2000),
  course: optional(0, 360),
  altitude: optional(-1000, 100000),
  accuracy: optional(0, 1_000_000),
  battery: optional(0, 100),
});

export function parseOsmand(req) {
  const raw = req.body?.location ? fromJson(req.body) : fromQuery(req.query);
  const result = positionSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new AppError(400, 'Datos inválidos.', details);
  }
  return result.data;
}
