// Estado de cada vehículo a partir de su GPS y su última posición.

// Un GPS está en línea si su último dato tiene menos de esta antigüedad.
// Con el intervalo por defecto de Traccar Client (5 min), 10 min tolera un envío perdido.
export const ONLINE_WINDOW_MIN = 10;
const ONLINE_WINDOW_MS = ONLINE_WINDOW_MIN * 60 * 1000;

// Quieto, el GPS suele marcar algunos km/h por imprecisión: por debajo de esto cuenta como detenido.
export const MOVING_MIN_KMH = 5;

// Colores de la landing: verde = en movimiento, ámbar = detenido, gris = sin datos.
// El color nunca va solo: siempre se muestra junto al nombre del estado.
export const FLEET_STATUS = {
  moving: { label: 'En movimiento', color: '#35cf88', text: '#35cf88' },
  stopped: { label: 'Detenido', color: '#f5a524', text: '#f5a524' },
  offline: { label: 'Sin señal', color: '#6b7686', text: '#6b7686' },
  nogps: { label: 'Sin GPS', color: '#3a4656', text: '#6b7686' },
};

// En el mapa, el vehículo seleccionado se pinta de azul (como en la landing).
export const SELECTED_COLOR = '#4c8dff';

// Con dato reciente (en movimiento o detenido) el GPS está "en línea".
export const isOnline = (status) => status === 'moving' || status === 'stopped';

export function vehicleStatus({ device, position, now }) {
  if (!device) return 'nogps';
  if (!position) return 'offline';
  const age = now - new Date(position.recordedAt).getTime();
  if (age > ONLINE_WINDOW_MS) return 'offline';
  return (position.speedKmh ?? 0) >= MOVING_MIN_KMH ? 'moving' : 'stopped';
}

/** Una fila por vehículo, en el orden de la API (estable entre actualizaciones). */
export function buildFleetRows(vehicles, devices, positions, now) {
  const deviceByVehicle = new Map(devices.map((d) => [d.vehicleId, d]));
  const positionByVehicle = new Map(positions.map((p) => [p.vehicleId, p]));
  return vehicles.map((vehicle) => {
    const device = deviceByVehicle.get(vehicle.id) ?? null;
    const position = positionByVehicle.get(vehicle.id) ?? null;
    return { vehicle, device, position, status: vehicleStatus({ device, position, now }) };
  });
}

export function countByStatus(rows) {
  const counts = { moving: 0, stopped: 0, offline: 0, nogps: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

// Minúsculas, sin tildes, espacios ni guiones: "jkl-908" encuentra "JKL908".
const normalize = (text) =>
  (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s-]/g, '');

export function matchesSearch(vehicle, query) {
  const q = normalize(query);
  if (!q) return true;
  return normalize(vehicle.name).includes(q) || normalize(vehicle.plate).includes(q);
}

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

// "hace 5 minutos", "hace 2 horas", "ayer"... (no negativo si el reloj del GPS va adelantado).
export function formatAgo(date, now) {
  const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return relative.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relative.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return relative.format(-days, 'day');
  return new Date(date).toLocaleDateString('es-CO', { dateStyle: 'medium' });
}
