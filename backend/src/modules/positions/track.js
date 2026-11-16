// Cálculo del recorrido de un vehículo a partir de sus posiciones (funciones puras, sin base de datos).

// Por debajo de esta velocidad el vehículo se considera quieto (ruido del GPS). Igual que el
// estado "en movimiento" del mapa en vivo (frontend/src/components/fleet/fleetStatus.js).
export const MOVING_KMH = 5;
// Quieto al menos este tiempo cuenta como parada (semáforos y trancones cortos no).
export const MIN_STOP_SECONDS = 180;
// Desplazarse más que esto entre dos posiciones es movimiento aunque el GPS reporte 0 km/h
// (p. ej. el celular dejó de enviar mientras se conducía). Estacionado, el GPS rara vez salta más de 100 m.
export const MOVED_METERS = 500;
// Una posición que exigiría ir más rápido que esto desde la anterior es un error del GPS.
export const MAX_PLAUSIBLE_KMH = 250;
// Máximo de puntos que se envían para dibujar el trayecto; el resumen usa todos.
export const MAX_TRACK_POINTS = 5000;

const EARTH_RADIUS_M = 6371000;

/** Distancia en metros entre dos posiciones (fórmula del haverseno). */
export function distanceMeters(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const seconds = (a, b) => (b.recordedAt.getTime() - a.recordedAt.getTime()) / 1000;

/**
 * Quita lo que no se puede usar: posiciones con la misma hora que la anterior y saltos imposibles
 * (cada posición se compara con la última aceptada, así un punto erróneo aislado no arrastra a los demás).
 * `points` debe venir ordenado por recordedAt.
 */
export function cleanTrack(points) {
  const kept = [];
  for (const p of points) {
    const last = kept.at(-1);
    if (last) {
      const dt = seconds(last, p);
      if (dt <= 0) continue;
      if ((distanceMeters(last, p) / dt) * 3.6 > MAX_PLAUSIBLE_KMH) continue;
    }
    kept.push(p);
  }
  return kept;
}

// ¿El vehículo se movió entre a y b? Se usa la velocidad que reporta el GPS; si no la envía, la calculada.
function isMoving(a, b, meters, dt) {
  if (meters >= MOVED_METERS) return true;
  if (a.speedKmh == null && b.speedKmh == null) return (meters / dt) * 3.6 >= MOVING_KMH;
  return Math.max(a.speedKmh ?? 0, b.speedKmh ?? 0) >= MOVING_KMH;
}

/**
 * Resumen y paradas de un recorrido ya limpio (ver cleanTrack).
 * - distanceKm: suma de los tramos en movimiento (los tramos quietos son ruido del GPS).
 * - movingSeconds / stoppedSeconds: tiempo entre posiciones según cada tramo.
 * - stops: tramos quietos seguidos que suman al menos MIN_STOP_SECONDS, con la ubicación donde empezaron.
 */
export function summarizeTrack(points) {
  let meters = 0;
  let movingSeconds = 0;
  let stoppedSeconds = 0;
  let maxSpeedKmh = null;
  const stops = [];
  let stopStart = null; // primera posición del tramo quieto en curso

  const closeStop = (end) => {
    if (stopStart && seconds(stopStart, end) >= MIN_STOP_SECONDS) {
      stops.push({
        startedAt: stopStart.recordedAt,
        endedAt: end.recordedAt,
        durationSeconds: Math.round(seconds(stopStart, end)),
        latitude: stopStart.latitude,
        longitude: stopStart.longitude,
      });
    }
    stopStart = null;
  };

  points.forEach((p, i) => {
    if (p.speedKmh != null) maxSpeedKmh = Math.max(maxSpeedKmh ?? 0, p.speedKmh);
    if (i === 0) return;
    const prev = points[i - 1];
    const dt = seconds(prev, p);
    const d = distanceMeters(prev, p);
    if (isMoving(prev, p, d, dt)) {
      closeStop(prev);
      meters += d;
      movingSeconds += dt;
    } else {
      stopStart ??= prev;
      stoppedSeconds += dt;
    }
  });
  if (points.length > 0) closeStop(points.at(-1));

  return {
    summary: {
      pointCount: points.length,
      startedAt: points[0]?.recordedAt ?? null,
      endedAt: points.at(-1)?.recordedAt ?? null,
      distanceKm: Math.round(meters) / 1000,
      movingSeconds: Math.round(movingSeconds),
      stoppedSeconds: Math.round(stoppedSeconds),
      maxSpeedKmh: maxSpeedKmh == null ? null : Math.round(maxSpeedKmh * 10) / 10,
    },
    stops,
  };
}

/**
 * Reduce los puntos a máximo `max` para dibujar, tomando uno de cada k y conservando siempre el último.
 * Devuelve el mismo arreglo si ya cabe.
 */
export function thinTrack(points, max = MAX_TRACK_POINTS) {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / (max - 1));
  const thinned = points.filter((_, i) => i % step === 0);
  if (thinned.at(-1) !== points.at(-1)) thinned.push(points.at(-1));
  return thinned;
}
