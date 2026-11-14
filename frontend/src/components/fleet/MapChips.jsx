import { FLEET_STATUS } from './fleetStatus.js';

const CHIPS = [
  { key: 'moving', label: () => 'en movimiento' },
  { key: 'stopped', label: (n) => (n === 1 ? 'detenido' : 'detenidos') },
  { key: 'offline', label: () => 'sin señal' },
];

/**
 * Contadores sobre el mapa (como "3 en movimiento · 1 detenido" de la landing).
 * También son la leyenda de colores y filtran: pulsar uno muestra solo esos vehículos.
 */
export default function MapChips({ counts, ready, filter, onFilter }) {
  return (
    <div className="absolute top-3 left-3 z-[500] flex flex-wrap gap-1.5 pr-3">
      {CHIPS.map(({ key, label }) => {
        const active = filter === key;
        const n = counts[key];
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onFilter(active ? 'all' : key)}
            title={active ? 'Quitar filtro' : `Ver solo: ${FLEET_STATUS[key].label.toLowerCase()}`}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] backdrop-blur-sm transition ${
              active
                ? 'border-blue/60 bg-blue/20 text-fg'
                : 'border-line-2 bg-panel/85 text-mute hover:border-white/30 hover:text-fg'
            }`}
          >
            <span
              className="size-[7px] rounded-full"
              style={{ backgroundColor: FLEET_STATUS[key].color }}
              aria-hidden="true"
            />
            <b className="font-mono text-xs font-medium text-white">{ready ? n : '—'}</b>
            {label(n)}
          </button>
        );
      })}
    </div>
  );
}
