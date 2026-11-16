import { FLEET_STATUS, SELECTED_COLOR } from '../fleet/fleetStatus.js';
import { formatDistance, formatDuration, formatTime } from './trackFormat.js';

function Stat({ label, value, unit }) {
  return (
    <div className="rounded-lg border border-line bg-ink-2 px-3 py-2.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-mono text-lg leading-none font-medium tracking-tight text-fg">
        {value}
        {unit && <small className="ml-1 text-[11px] font-normal text-mute">{unit}</small>}
      </dd>
    </div>
  );
}

/** Puntos de la línea de tiempo: inicio, paradas y fin, en orden. */
export function timelineItems(data, endLabel) {
  const { summary, stops, points } = data;
  if (points.length === 0) return [];
  const first = points[0];
  const last = points.at(-1);
  const items = [
    { key: 'start', title: 'Inicio', time: formatTime(summary.startedAt), color: FLEET_STATUS.moving.color, point: [first.latitude, first.longitude] },
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
    items.push({ key: 'end', title: endLabel, time: formatTime(summary.endedAt), color: SELECTED_COLOR, point: [last.latitude, last.longitude] });
  }
  return items;
}

/**
 * Resumen del día y línea de tiempo. Pulsar un punto lo selecciona y el mapa va hasta él.
 * onSelect(item) recibe un elemento de timelineItems.
 */
export default function TrackPanel({ data, items, selected, onSelect }) {
  const { summary, simplified, truncated } = data;
  return (
    <>
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Distancia" value={formatDistance(summary.distanceKm)} />
        <Stat label="Vel. máxima" value={summary.maxSpeedKmh == null ? '—' : Math.round(summary.maxSpeedKmh)} unit={summary.maxSpeedKmh == null ? null : 'km/h'} />
        <Stat label="En movimiento" value={formatDuration(summary.movingSeconds)} />
        <Stat label="Detenido" value={formatDuration(summary.stoppedSeconds)} />
      </dl>

      <p className="eyebrow mt-5 mb-2">
        Línea de tiempo <span className="ml-1">{data.stops.length} {data.stops.length === 1 ? 'parada' : 'paradas'}</span>
      </p>
      <ol className="relative grid gap-0.5 before:absolute before:top-3 before:bottom-3 before:left-[15px] before:w-px before:bg-line">
        {items.map((item) => {
          const isSelected = selected === item.key;
          return (
            <li key={item.key} className="relative">
              <button
                type="button"
                onClick={() => onSelect(item)}
                aria-pressed={isSelected}
                className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition ${
                  isSelected ? 'bg-blue/15' : 'hover:bg-white/5'
                }`}
              >
                <span
                  className="relative mt-0.5 grid size-[15px] shrink-0 place-items-center rounded-full border-2 border-white font-mono text-[8px] font-semibold text-panel"
                  style={{ background: item.color }}
                  aria-hidden="true"
                >
                  {item.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-fg">{item.title}</span>
                  <span className="block font-mono text-[11px] text-mute">{item.time}</span>
                </span>
                {item.detail && <span className="shrink-0 font-mono text-[11px] text-amber">{item.detail}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {data.stops.length === 0 && items.length > 0 && (
        <p className="mt-2 px-2 text-xs text-dim">Sin paradas de más de 3 minutos.</p>
      )}
      {(simplified || truncated) && (
        <p className="mt-4 text-[11px] leading-relaxed text-dim">
          {truncated
            ? 'El recorrido tiene demasiadas posiciones: se muestra solo la primera parte del día.'
            : `Para dibujarlo se usan ${data.points.length.toLocaleString('es-CO')} de ${summary.pointCount.toLocaleString('es-CO')} posiciones; el resumen usa todas.`}
        </p>
      )}
    </>
  );
}
