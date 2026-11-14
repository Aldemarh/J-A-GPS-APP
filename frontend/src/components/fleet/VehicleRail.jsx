import { useEffect, useRef } from 'react';
import StatusText from './StatusText.jsx';
import { formatAgo, isOnline } from './fleetStatus.js';

/**
 * Lista de vehículos del mapa en vivo: nombre, placa, estado y velocidad.
 * Al seleccionar uno desde el mapa, la lista se desplaza hasta él.
 */
export default function VehicleRail({ rows, now, selectedId, onSelect }) {
  const listRef = useRef(null);

  // Solo mueve la columna de la lista (escritorio). No usa scrollIntoView porque también
  // desplazaría la página y, en celular, sacaría el mapa de la pantalla.
  useEffect(() => {
    const list = listRef.current;
    const box = list?.parentElement;
    const item = selectedId && list?.querySelector(`[data-vehicle="${selectedId}"]`);
    if (!item || !box || box.scrollHeight <= box.clientHeight) return;
    const boxRect = box.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    if (itemRect.top < boxRect.top) box.scrollTop -= boxRect.top - itemRect.top;
    else if (itemRect.bottom > boxRect.bottom) box.scrollTop += itemRect.bottom - boxRect.bottom;
  }, [selectedId]);

  return (
    <ul ref={listRef} className="grid gap-1">
      {rows.map((row) => {
        const { vehicle, position, status } = row;
        const selected = vehicle.id === selectedId;
        const online = isOnline(status);
        const suffix = status === 'offline' && position ? ` · ${formatAgo(position.recordedAt, now)}` : '';
        return (
          <li key={vehicle.id}>
            <button
              type="button"
              data-vehicle={vehicle.id}
              aria-pressed={selected}
              onClick={() => onSelect(row)}
              className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-[10px] border p-2.5 text-left transition ${
                selected ? 'border-blue/40 bg-blue/10' : 'border-transparent hover:bg-white/[0.04]'
              }`}
            >
              <span className="truncate text-[13.5px] font-medium text-fg">
                {vehicle.name}
                <span className="ml-1.5 font-mono text-[11px] font-normal text-mute">{vehicle.plate}</span>
              </span>
              <span className="row-span-2 self-center text-right font-mono text-[13px] leading-tight font-medium text-fg">
                {online ? Math.round(position.speedKmh ?? 0) : '—'}
                <small className="block text-[10px] font-normal text-dim">km/h</small>
              </span>
              <StatusText status={status} suffix={suffix} className="text-[11.5px]" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
