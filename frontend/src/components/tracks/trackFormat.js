// Fechas y duraciones de la pantalla de recorridos. Los días son del calendario local del navegador.

const pad = (n) => String(n).padStart(2, '0');

/** Fecha local como "AAAA-MM-DD" (el formato de <input type="date"> y de la URL). */
export function toDayString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayString = () => toDayString(new Date());

/** ¿Es "AAAA-MM-DD" una fecha real? */
export function isDayString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function parseDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Inicio y fin (exclusivo) del día en hora local. */
export function dayRange(day) {
  const from = parseDay(day);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

export function addDays(day, n) {
  const date = parseDay(day);
  date.setDate(date.getDate() + n);
  return toDayString(date);
}

/** "Domingo, 16 de noviembre de 2026" */
export function formatDay(day) {
  const text = parseDay(day).toLocaleDateString('es-CO', { dateStyle: 'full' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "7:05 a. m." */
export const formatTime = (value) => new Date(value).toLocaleTimeString('es-CO', { timeStyle: 'short' });

/** "45 s", "27 min", "1 h 05 min" */
export function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds);
  if (s < 60) return `${s} s`;
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${pad(minutes % 60)} min`;
}

/** "12,4 km" o "850 m" */
export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString('es-CO', { maximumFractionDigits: km < 100 ? 1 : 0 })} km`;
}
