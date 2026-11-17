import { FLEET_STATUS, SELECTED_COLOR } from '../fleet/fleetStatus.js';
import { formatDuration, formatTime } from './trackFormat.js';

/**
 * Puntos de la línea de tiempo de un recorrido: inicio, paradas y fin, en orden.
 * `key` es 'start', 'end' o el índice de la parada (igual que en TrackMap); `point` es [lat, lng].
 */
export function timelineItems(data, endLabel) {
  const { summary, stops, points } = data;
  if (points.length === 0) return [];
  const first = points[0];
  const last = points.at(-1);
  const items = [
    {
      key: 'start',
      title: 'Inicio',
      time: formatTime(summary.startedAt),
      color: FLEET_STATUS.moving.color,
      point: [first.latitude, first.longitude],
    },
    ...stops.map((s, i) => ({
      key: i,
      title: `Parada ${i + 1}`,
      time: `${formatTime(s.startedAt)} – ${formatTime(s.endedAt)}`,
      detail: formatDuration(s.durationSeconds),
      color: FLEET_STATUS.stopped.color,
      number: i + 1,
      point: [s.latitude, s.longitude],
    })),
  ];
  if (points.length > 1) {
    items.push({
      key: 'end',
      title: endLabel,
      time: formatTime(summary.endedAt),
      color: SELECTED_COLOR,
      point: [last.latitude, last.longitude],
    });
  }
  return items;
}
