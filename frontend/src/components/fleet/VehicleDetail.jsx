import { Link } from 'react-router-dom';
import StatusText from './StatusText.jsx';
import { FLEET_STATUS, formatAgo, isOnline } from './fleetStatus.js';
import { IconClose, IconCrosshair, IconExternal } from '../icons.jsx';

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line py-1.5">
      <dt className="text-mute">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-fg">{children}</dd>
    </div>
  );
}

/**
 * Detalle del vehículo seleccionado (columna derecha de la landing).
 * Solo muestra datos que el GPS realmente envía: nada de motor ni dirección inventados.
 */
export default function VehicleDetail({ row, now, canEdit, onCenter, onClose }) {
  const { vehicle, device, position, status } = row;
  const online = isOnline(status);
  const gpsLabel = status === 'nogps' ? 'Sin GPS' : online ? 'GPS activo' : 'GPS sin señal';

  return (
    <section aria-label={`Detalle de ${vehicle.name}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-fg">{vehicle.name}</h2>
          <p className="font-mono text-[11px] text-mute">
            {vehicle.plate} · {gpsLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
          title="Cerrar detalle"
          className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-mute transition hover:bg-white/5 hover:text-fg"
        >
          <IconClose className="size-4" />
        </button>
      </div>

      <p className="mt-3 mb-2 flex items-baseline gap-1.5 font-mono text-[34px] leading-none font-medium tracking-[-0.04em] text-fg">
        {online ? Math.round(position.speedKmh ?? 0) : '—'}
        <small className="text-[11px] font-normal tracking-normal text-mute">km/h</small>
      </p>

      <dl className="text-xs">
        <Row label="Estado">
          <StatusText status={status} />
        </Row>
        <Row label="Último dato">
          {position ? (
            <span title={new Date(position.recordedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'medium' })}>
              {formatAgo(position.recordedAt, now)}
            </span>
          ) : (
            'Sin datos'
          )}
        </Row>
        {position?.battery != null && <Row label="Batería">{Math.round(position.battery)} %</Row>}
        {position?.accuracy != null && <Row label="Precisión">± {Math.round(position.accuracy)} m</Row>}
        {position && (
          <Row label="Coordenadas">
            <span className="font-mono text-[11px]">
              {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
            </span>
          </Row>
        )}
        {device && (
          <Row label="Dispositivo">
            <span className="block truncate">{device.name}</span>
          </Row>
        )}
      </dl>

      {position ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onCenter} className="btn btn-ghost px-3 py-1.5 text-xs">
            <IconCrosshair className="size-4" />
            Centrar en el mapa
          </button>
          <a
            href={`https://www.google.com/maps?q=${position.latitude},${position.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost px-3 py-1.5 text-xs"
          >
            <IconExternal className="size-4" />
            Google Maps
          </a>
        </div>
      ) : (
        <p className="mt-3 text-xs text-mute">
          {status !== 'nogps' ? (
            'Aparecerá en el mapa cuando su GPS envíe la primera ubicación.'
          ) : canEdit ? (
            <>
              Conecta su GPS en{' '}
              <Link to="/vehiculos" className="font-medium text-blue hover:underline">
                Vehículos
              </Link>
              .
            </>
          ) : (
            'Este vehículo aún no tiene GPS.'
          )}
        </p>
      )}
    </section>
  );
}

const SUMMARY_ORDER = ['moving', 'stopped', 'offline', 'nogps'];

// Columna derecha cuando no hay vehículo seleccionado.
export function FleetOverview({ counts, ready, updatedAt }) {
  return (
    <section aria-label="Resumen de la flota">
      <p className="eyebrow">Resumen</p>
      <dl className="mt-3 text-xs">
        {SUMMARY_ORDER.map((key) => (
          <Row key={key} label={<StatusText status={key} />}>
            <span className="font-mono">{ready ? counts[key] : '—'}</span>
          </Row>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-dim">
        Selecciona un vehículo en la lista o en el mapa para ver su velocidad, batería y última ubicación.
      </p>
      {updatedAt && (
        <p className="mt-2 font-mono text-[10.5px] text-dim">
          Actualizado {updatedAt.toLocaleTimeString('es-CO', { timeStyle: 'medium' })}
        </p>
      )}
      <p className="sr-only">
        Colores del mapa: {SUMMARY_ORDER.slice(0, 3).map((k) => FLEET_STATUS[k].label).join(', ')}; el vehículo
        seleccionado se muestra en azul.
      </p>
    </section>
  );
}
